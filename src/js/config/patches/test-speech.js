// External clock repeats complete text. A slow, attenuated LFO changes Rate
// during the phrase; Finish prevents incoming clocks from chopping words.
export default {
    name:'Test - Speech',factory:true,
    state:{version:3,plugins:{core:1},modules:[
        {id:'clock',type:'clk',row:1,index:0},
        {id:'motion',type:'lfo',row:1,index:1},
        {id:'depth',type:'atten',row:1,index:2},
        {id:'speech',type:'speech',row:1,index:3},
        {id:'out',type:'out',row:1,index:4}
    ],params:{
        clock:{rate:.1,pause:0},motion:{rateKnob:.12,waveKnob:0,range:0},depth:{atten1:.6},
        speech:{pitch:0,rate:1,contour:1,breath:.15,level:.8,female:0,restart:0},out:{volume:.45}
    },cables:[
        {fromModule:'clock',fromPort:'clock',toModule:'speech',toPort:'trig'},
        {fromModule:'motion',fromPort:'primary',toModule:'depth',toPort:'in1'},
        {fromModule:'depth',fromPort:'out1',toModule:'speech',toPort:'rateCV'},
        {fromModule:'speech',fromPort:'out',toModule:'out',toPort:'L'},
        {fromModule:'speech',fromPort:'out',toModule:'out',toPort:'R'}
    ],midiMappings:{}}
};
