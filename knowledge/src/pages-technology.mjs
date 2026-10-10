import { pages as microsoft } from './pages-tech-microsoft.mjs';
import { pages as msplatform } from './pages-tech-msplatform.mjs';
import { pages as ai } from './pages-tech-ai.mjs';
import { pages as aiFrameworks } from './pages-tech-ai-frameworks.mjs';
import { pages as languages } from './pages-tech-languages.mjs';
import { pages as systems } from './pages-tech-languages-systems.mjs';
import { pages as web } from './pages-tech-web.mjs';
import { pages as protocols } from './pages-tech-web-protocols.mjs';
import { pages as data } from './pages-tech-data.mjs';
import { pages as dataTools } from './pages-tech-data-tools.mjs';
import { pages as devops } from './pages-tech-devops.mjs';
import { pages as devopsConfig } from './pages-tech-devops-config.mjs';
import { pages as security } from './pages-tech-security.mjs';
import { pages as securityWeb } from './pages-tech-security-web.mjs';

export const pages = [
  ...microsoft,
  ...msplatform,
  ...ai,
  ...aiFrameworks,
  ...languages,
  ...systems,
  ...web,
  ...protocols,
  ...data,
  ...dataTools,
  ...devops,
  ...devopsConfig,
  ...security,
  ...securityWeb,
];
