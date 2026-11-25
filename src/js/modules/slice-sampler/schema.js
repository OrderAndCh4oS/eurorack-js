export const channels = ['A', 'B'];
export const choices = {
    source: ['Factory', 'Local'],
    playMode: ['Forward', 'Reverse', 'Fwd loop', 'Rev loop'],
    order: ['Forward', 'Backward', 'Random', 'Address'],
    method: ['Grid', 'Zero', 'Manual'],
    assign1: ['Off', 'Pitch', 'Slice', 'Level', 'Reverse'],
    assign2: ['Off', 'Pitch', 'Slice', 'Level', 'Reverse'],
    assign3: ['Off', 'Pitch', 'Slice', 'Level', 'Reverse']
};

function perChannel(controls) {
    return channels.flatMap(ch => controls.map(([id,label,properties]) => ({
        id: id + ch, param: id + ch, label, ...properties
    })));
}

function ports(definitions) {
    return channels.flatMap(ch => definitions.map(([key,label,signal]) => ({
        id: key + ch, port: key + ch, label, signal
    })));
}

const labels = { source:'Source', playMode:'Play', order:'Order', method:'Cuts', assign1:'CV 1', assign2:'CV 2', assign3:'CV 3' };

export const ui = {
    knobs: perChannel([
        ['tune', 'Tune', { min: -24, max: 24, default: 0 }],
        ['level', 'Level', { min: 0, max: 1, default: 0.8 }],
        ['slice', 'Slice', { min: 1, max: 32, step: 1, default: 1 }],
        ['count', 'Count', { min: 1, max: 32, step: 1, default: 4 }]
    ]),
    buttons: perChannel(Object.entries(choices).map(([key,options]) => [key,labels[key],{
        values: options.map((_,i) => i), default: key === 'assign1' ? 1 : key === 'assign2' ? 2 : 0
    }])),
    actions: perChannel(['audition','stop','record'].map((id,i) => [id,['Audition','Stop','Record'][i],{mode:'trigger',default:0}])),
    state: channels.map(ch => ({param:'markers'+ch,default:[]})),
    leds: channels.flatMap(ch => ['playing'+ch,'recording'+ch]),
    inputs: ports([['trig','Trig','trigger'],['cv1','CV 1','cv'],['cv2','CV 2','cv'],['cv3','CV 3','cv'],['rec','Rec in','audio']]),
    outputs: ports([['out','Out','audio']])
};
