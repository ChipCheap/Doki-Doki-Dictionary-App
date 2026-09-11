import { mount } from 'svelte';
import './ui/theme.css';
import './ui/base.css';
import App from './ui/App.svelte';
import { installFontFaces } from './ui/fonts';
import { pwa } from './ui/pwa.svelte';

installFontFaces();
// Before mount: `beforeinstallprompt` fires once, early, and would be missed by
// a listener attached later.
pwa.listen();

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app mount point.');

export default mount(App, { target });
