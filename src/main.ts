import { mount } from 'svelte';
import './ui/theme.css';
import './ui/base.css';
import App from './ui/App.svelte';
import { installFontFaces } from './ui/fonts';

installFontFaces();

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app mount point.');

export default mount(App, { target });
