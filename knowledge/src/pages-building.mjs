import { pages as interfaces } from './pages-building-interfaces.mjs';
import { pages as platforms } from './pages-building-platforms.mjs';
import { pages as basics } from './pages-building-basics.mjs';

export const pages = [...interfaces, ...platforms, ...basics];
