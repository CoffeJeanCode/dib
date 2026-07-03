import { PurgeCSS } from 'purgecss';
import fs from 'fs';
import { globSync } from 'glob';

async function purge() {
  const cssFiles = globSync('src/**/*.css', { windowsPathsNoEscape: true });
  // Fix slashes for PurgeCSS
  const contentFiles = globSync(['src/**/*.tsx', 'src/**/*.ts', 'src/**/*.jsx', 'src/**/*.js', 'index.html'], { windowsPathsNoEscape: true })
      .map(p => p.replace(/\\/g, '/'));
  
  console.log(`Found ${cssFiles.length} css files and ${contentFiles.length} content files.`);
  
  const purgeCSSResult = await new PurgeCSS().purge({
    content: contentFiles,
    css: cssFiles.map(p => p.replace(/\\/g, '/')),
    safelist: [
      /sidebar-icon--/,
      /home-conn-icon--/,
      /tn--focus/,
      /tn-col--/,
      /tn-col-tag--/,
      /dialog--/,
      /dialog-btn--/,
      /inline-edit-input--xs/,
      /sidebar-item--/,
      /sidebar-db-item--/,
      /sidebar-db-selector-chevron--/,
      /sidebar-db-dropdown-section-header--/,
      /sidebar-db-option--/,
      /sidebar-tab--/,
      /tree-item--/,
      /tree-folder--/,
      /tn--/,
      /sidebar-db-item-icon--muted/,
      /sidebar-db-item-spacer--lg/,
      /sidebar-db-item-name--xs/,
      /sidebar-db-item-name--bold/,
      /sidebar-db-item-input-wrapper/,
      /tree-item__spacer--sm/,
      /tree-item-icon--muted/,
      /tree-item-pin/,
      /tree-inline-create-wrapper/,
      /tree-inline-input-wrapper/,
      /home-actions-wrapper/,
      /home-new-btn--secondary/,
      /home-sections-container/,
      /home-recent-col/
    ],
    defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || []
  });

  let removed = 0;
  for (const result of purgeCSSResult) {
    let relativePath = result.file;
    if (relativePath) {
      const originalSize = fs.statSync(relativePath).size;
      const newSize = Buffer.byteLength(result.css, 'utf8');
      if (originalSize !== newSize) {
        console.log(`Purged ${relativePath}: ${originalSize} -> ${newSize} bytes`);
        fs.writeFileSync(relativePath, result.css);
        removed += (originalSize - newSize);
      }
    }
  }
  console.log(`Total removed: ${removed} bytes`);
}

purge().catch(console.error);
