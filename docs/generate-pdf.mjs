/**

 * Generates DOJOBID PDF documents using puppeteer-core + Edge.

 *

 * Usage:

 *   node generate-pdf.mjs                    # build specification (default)

 *   node generate-pdf.mjs build-spec

 *   node generate-pdf.mjs operators-manual
 *
 *   node generate-pdf.mjs deploy-vercel-railway-neon

 */

import { readFileSync, writeFileSync } from 'node:fs';

import { dirname, join } from 'node:path';

import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer-core';



const __dirname = dirname(fileURLToPath(import.meta.url));

const EDGE =

  process.env.PUPPETEER_EXECUTABLE_PATH ??

  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';



const DOCS = {

  'build-spec': {

    md: 'DOJOBID-App-Build-Specification.md',

    pdf: 'DOJOBID-App-Build-Specification.pdf',

    title: 'DOJOBID App Build Specification',

    svg: 'do-jobid-er-diagram.svg',

  },

  'operators-manual': {

    md: 'DOJOBID-Operators-Manual.md',

    pdf: 'DOJOBID-Operators-Manual.pdf',

    title: 'DOJOBID Operators Manual',

    svg: null,

  },

  'deploy-vercel-railway-neon': {

    md: 'Deploy-Vercel-Railway-Neon.md',

    pdf: 'Deploy-Vercel-Railway-Neon.pdf',

    title: 'Deploy DOJOBID — Path A (Vercel + Railway + Neon)',

    svg: null,

  },

};



const arg = process.argv[2] ?? 'build-spec';

const doc = DOCS[arg];

if (!doc) {

  console.error(`Unknown document "${arg}". Use: ${Object.keys(DOCS).join(', ')}`);

  process.exit(1);

}



const mdPath = join(__dirname, doc.md);

const cssPath = join(__dirname, 'pdf-styles.css');

const outPath = join(__dirname, doc.pdf);



function mdToHtml(md) {

  let html = md.replace(/^---[\s\S]*?---\n/, '');



  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');

  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');

  html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');



  html = html.replace(

    /!\[([^\]]*)\]\(\.\/do-jobid-er-diagram\.svg\)/,

    '<div class="diagram">__SVG__</div>',

  );

  html = html.replace(

    /!\[([^\]]*)\]\(\.\/deploy-screenshots\/([^)]+)\)/g,

    (_m, alt, relPath) => {

      const imgPath = join(__dirname, 'deploy-screenshots', relPath).replace(/\\/g, '/');

      const caption = alt.trim();

      return `<figure class="screenshot"><img src="file:///${imgPath}" alt="${caption}"/>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;

    },

  );



  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {

    return `<pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;').trimEnd()}</code></pre>`;

  });



  html = html.replace(/^\|(.+)\|$/gm, (line) => {

    if (/^\|[\s\-:|]+\|$/.test(line)) return '__TABLE_SEP__';

    const cells = line

      .slice(1, -1)

      .split('|')

      .map((c) => c.trim());

    return `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;

  });



  html = html.replace(/(<tr>[\s\S]*?<\/tr>\n?)+/g, (block) => {

    if (!block.includes('__TABLE_SEP__')) return block;

    const rows = block.split('\n').filter((r) => r && !r.includes('__TABLE_SEP__'));

    if (rows.length === 0) return block;

    const [head, ...body] = rows;

    const headCells = head.replace(/^<tr>/, '').replace(/<\/tr>$/, '');

    const thead = `<thead><tr>${headCells.replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>')}</tr></thead>`;

    const tbody = `<tbody>${body.join('\n')}</tbody>`;

    return `<table>${thead}${tbody}</table>`;

  });



  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (block) => `<ul>${block}</ul>`);



  html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');

  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (block) => {

    if (block.startsWith('<ul>')) return block;

    return `<ol>${block}</ol>`;

  });



  html = html.replace(/<div class="cover-meta">\n\n([\s\S]*?)\n\n<\/div>/, (_m, inner) => {

    return `<div class="cover-meta">${inner.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</div>`;

  });



  html = html.replace(/<div class="page-break"><\/div>/g, '<div class="page-break"></div>');



  html = html.replace(/^---$/gm, '<hr/>');



  html = html

    .split('\n\n')

    .map((block) => {

      const trimmed = block.trim();

      if (!trimmed) return '';

      if (/^<(h[123]|table|pre|ul|ol|blockquote|div|hr|img|figure)/.test(trimmed)) return trimmed;

      if (trimmed.startsWith('<')) return trimmed;

      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;

    })

    .filter(Boolean)

    .join('\n');



  return html;

}



const md = readFileSync(mdPath, 'utf8');

const css = readFileSync(cssPath, 'utf8');

let body = mdToHtml(md);



if (doc.svg && body.includes('__SVG__')) {

  const svg = readFileSync(join(__dirname, doc.svg), 'utf8');

  body = body.replace('__SVG__', svg);

}



const htmlDoc = `<!DOCTYPE html>

<html lang="en">

<head>

  <meta charset="utf-8"/>

  <title>${doc.title}</title>

  <style>${css}

    .diagram svg { width: 100%; height: auto; }

    .page-break { page-break-before: always; height: 0; }

  </style>

</head>

<body>${body}</body>

</html>`;



const tmpHtml = join(__dirname, `_pdf-temp-${arg}.html`);

writeFileSync(tmpHtml, htmlDoc, 'utf8');



const browser = await puppeteer.launch({

  executablePath: EDGE,

  headless: true,

  args: ['--no-sandbox', '--disable-setuid-sandbox'],

});



try {

  const page = await browser.newPage();

  await page.goto(`file:///${tmpHtml.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });

  await page.pdf({

    path: outPath,

    format: 'A4',

    printBackground: true,

    margin: { top: '20mm', right: '18mm', bottom: '22mm', left: '18mm' },

  });

  console.log(`PDF written to ${outPath}`);

} finally {

  await browser.close();

}


