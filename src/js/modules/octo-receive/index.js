import { createOctoPanel } from '../octo-send/panel.js';

export default {
    id: 'octo-receive',
    name: 'OCTO RECEIVE',
    ...createOctoPanel('out')
};
