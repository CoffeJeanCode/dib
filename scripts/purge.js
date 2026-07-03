import { PurgeCSS } from 'purgecss';
import fs from 'fs';
import { globSync } from 'glob';

async function purge() {
  const cssFiles = globSync('src/**/*.css', { windowsPathsNoEscape: true });
  const contentFiles = globSync(['src/**/*.tsx', 'src/**/*.ts', 'src/**/*.jsx', 'src/**/*.js', 'index.html'], { windowsPathsNoEscape: true });
  
  console.log(`Found ${cssFiles.length} css files and ${contentFiles.length} content files.`);

  // Append a fake class to test
  fs.appendFileSync(cssFiles[0], '\n.super-fake-unused-class-xyz123 { color: red; }\n');

  const purgeCSSResult = await new PurgeCSS().purge({
    content: contentFiles,
    css: cssFiles,
    safelist: [/sidebar-icon--/, /home-conn-icon--/, /tn--focus/, /tn-col--/, /tn-col-tag--/, /dialog--danger/, /dialog-btn--/, /inline-edit-input--xs/, /sidebar-item--/, /sidebar-db-item--/, /sidebar-db-selector-chevron--/, /sidebar-db-dropdown-section-header--/, /sidebar-db-option--/, /sidebar-tab--/, /tree-item--/, /tree-folder--/]
  });

  let removed = 0;
  for (const result of purgeCSSResult) {
    let relativePath = result.file;
    if (relativePath) {
      const originalSize = fs.statSync(relativePath).size;
      fs.writeFileSync(relativePath, result.css);
      const newSize = fs.statSync(relativePath).size;
      if (originalSize !== newSize) {
        console.log(`Purged ${relativePath}: ${originalSize} -> ${newSize} bytes`);
        removed += (originalSize - newSize);
      }
    }
  }
  console.log(`Total removed: ${removed} bytes`);
}

purge().catch(console.error);
