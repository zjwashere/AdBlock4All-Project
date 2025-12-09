// Run this script with Node.js to convert ABP format to declarativeNetRequest format
// Usage: node convert-rules.js

const fs = require('fs');

// Read the ABP filter list
const abpContent = fs.readFileSync('oisd_small_abp.txt', 'utf8');
const lines = abpContent.split('\n');

const rules = [];
let ruleId = 1;
const MAX_RULES = 30000; // Chrome has a limit of 30,000 static rules per ruleset

// Parse ABP syntax and convert to declarativeNetRequest rules
for (const line of lines) {
  // Skip comments and empty lines
  if (!line.trim() || line.startsWith('!') || line.startsWith('[')) {
    continue;
  }
  
  // Skip element hiding rules (##)
  if (line.includes('##') || line.includes('#@#')) {
    continue;
  }
  
  let filter = line.trim();
  
  // Skip exception rules for now (those starting with @@)
  if (filter.startsWith('@@')) {
    continue;
  }
  
  // Remove options for simplicity (everything after $)
  if (filter.includes('$')) {
    filter = filter.split('$')[0];
  }
  
  // Convert ABP wildcards to urlFilter format
  // Remove leading ||
  if (filter.startsWith('||')) {
    filter = filter.substring(2);
  }
  
  // Remove leading |
  if (filter.startsWith('|')) {
    filter = filter.substring(1);
  }
  
  // Remove trailing |
  if (filter.endsWith('|')) {
    filter = filter.substring(0, filter.length - 1);
  }
  
  // Skip if empty after processing
  if (!filter) {
    continue;
  }
  
  // Convert to urlFilter format
  let urlFilter = filter.replace(/\*/g, '*').replace(/\^/g, '');
  
  // Add wildcards if needed
  if (!urlFilter.startsWith('*')) {
    urlFilter = '*' + urlFilter;
  }
  if (!urlFilter.endsWith('*')) {
    urlFilter = urlFilter + '*';
  }
  
  // Create the rule
  const rule = {
    id: ruleId++,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: urlFilter,
      resourceTypes: ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object", "xmlhttprequest", "ping", "csp_report", "media", "websocket", "other"]
    }
  };
  
  rules.push(rule);
  
  // Stop if we hit the limit
  if (rules.length >= MAX_RULES) {
    console.log(`Reached maximum rule limit (${MAX_RULES}). Stopping conversion.`);
    break;
  }
}

// Write to rules.json
fs.writeFileSync('rules.json', JSON.stringify(rules, null, 2));

console.log(`Converted ${rules.length} rules to rules.json`);
console.log(`Skipped ${lines.length - rules.length} lines (comments, element hiding, exceptions, etc.)`);
console.log('\nImportant: Chrome has a 30,000 static rule limit per ruleset.');
console.log('For larger lists, consider using dynamic rules or multiple rulesets.');