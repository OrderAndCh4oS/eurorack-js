import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir, mkdtemp, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { gunzipSync } from 'node:zlib';
import { SPEECH_ROOT as root, SPEECH_ASSETS, speechInputs, sha256, speechManifest, validateSpeechAssets } from './speech-assets.mjs';
import { validateSpeechPhrase } from '../src/js/audio/speech-plan.js';
const crate=join(root,'wasm/speech-planner'), assets=join(root,SPEECH_ASSETS);
const cargo=(...args)=>execFileSync('cargo',args,{cwd:crate,encoding:'utf8',stdio:['ignore','pipe','inherit']});
const version=/name = "wasm-bindgen"\nversion = "([^"]+)"/.exec(await readFile(join(crate,'Cargo.lock'),'utf8'))?.[1];
if(execFileSync('wasm-bindgen',['--version'],{encoding:'utf8'}).trim()!==`wasm-bindgen ${version}`) throw new Error('Install matching wasm-bindgen CLI.');
const source=await speechInputs(root);
cargo('build','--lib','--release','--locked','--offline','--target','wasm32-unknown-unknown');
const metadata=JSON.parse(cargo('metadata','--locked','--offline','--format-version','1','--filter-platform','wasm32-unknown-unknown'));
const temp=await mkdtemp(join(tmpdir(),'eurorack-speech-'));
try {
    execFileSync('wasm-bindgen',[join(metadata.target_directory,'wasm32-unknown-unknown/release/eurorack_speech_planner.wasm'),'--target','web','--no-typescript','--out-dir',temp,'--out-name','speech'],{stdio:'inherit'});
    const wasm=await readFile(join(temp,'speech_bg.wasm'));
    const wasmFile=`speech-${sha256(wasm)}.wasm`;
    const js=(await readFile(join(temp,'speech.js'),'utf8')).replaceAll('speech_bg.wasm',wasmFile);
    const moduleFile=`speech-${sha256(js)}.js`;
    // Load generated bindings locally to build the default phrase using the same
    // dictionary and planner shipped to the browser Worker.
    await writeFile(join(temp,'speech.mjs'),js);
    const api=await import(pathToFileURL(join(temp,'speech.mjs')).href);
    api.initSync({module:wasm});
    const dictionary=await readFile(join(crate,'data/cmudict.txt.gz'));
    const dictionaryFile=`cmudict-${sha256(dictionary)}.gz`;
    const planner=new api.SpeechPlanner(gunzipSync(dictionary).toString('utf8'));
    const phrase=validateSpeechPhrase(JSON.parse(planner.plan('Hello. We can make music with words.'))); planner.free();
    const phraseSource=`// Prepared with the pinned English dictionary and CHIMERA planner.\nexport const DEFAULT_SPEECH = ${JSON.stringify(phrase)};\n`;
    const phraseFile=`speech-default-${sha256(phraseSource)}.js`;
    const notices=['Speech planner and pronunciation dictionary notices',await readFile(join(crate,'data/CMUDICT-LICENSE.txt'),'utf8')];
    for(const pkg of metadata.packages.filter(p=>p.name!=='eurorack-speech-planner').sort((a,b)=>a.name.localeCompare(b.name))) {
        const dir=dirname(pkg.manifest_path), names=(await readdir(dir)).filter(n=>/^(LICENSE|LICENCE|COPYING)(?:[.\-_].*)?$/i.test(n));
        if(pkg.license_file && !names.includes(pkg.license_file)) names.push(pkg.license_file);
        const texts=[];
        for(const name of names.sort()) { try { texts.push(await readFile(join(dir,name),'utf8')); } catch(e) { if(e.code!=='EISDIR') throw e; } }
        if(!texts.length) throw new Error(`Missing license for ${pkg.name}`);
        notices.push(`\n${pkg.name} ${pkg.version}\n${pkg.license || ''}\n${texts.join('\n')}`);
    }
    if((await speechInputs(root)).version!==source.version) throw new Error('Speech sources changed during build.');
    const files=new Map([[moduleFile,js],[wasmFile,wasm],[dictionaryFile,dictionary],[phraseFile,phraseSource],['LICENSES.txt',notices.join('\n')]]);
    const manifest={schemaVersion:1,...source,moduleFile,wasmFile,dictionaryFile,phraseFile,files:[...files].map(([name,data])=>({name,bytes:Buffer.byteLength(data),sha256:sha256(data)}))};
    await mkdir(assets,{recursive:true});
    for(const [name,data] of files) await writeFile(join(assets,name),data);
    await writeFile(join(assets,'artifact-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    await writeFile(join(assets,'manifest.js'),speechManifest(manifest));
    await validateSpeechAssets({root});
    for(const name of await readdir(assets)) if(/^(speech(?:-default)?|cmudict)-[a-f0-9]{64}\.(js|wasm|gz)$/.test(name) && !files.has(name)) await rm(join(assets,name));
    console.log(`Built speech planner: ${wasm.length} bytes WASM; default phrase ${phrase.bodies[0].duration.toFixed(2)}s, ${phrase.bodies[0].gestures.length} gestures.`);
} finally { await rm(temp,{recursive:true,force:true}); }
