#!/usr/bin/env node

/**
 * ACE Markdown Validator
 *
 * Validates structural correctness of ACE markdown files:
 * - YAML frontmatter schema (commands and agents)
 * - Required sections per file type
 * - Semantic XML tag closure
 * - @-reference existence
 * - Naming conventions
 *
 * Usage:
 *   node scripts/validate-markdown.js                    # Validate all
 *   node scripts/validate-markdown.js path/to/file.md    # Validate specific files
 *
 * Exit code 0 = all valid, 1 = errors found
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];
let filesChecked = 0;

// ─── File type detection ───

function getFileType(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  if (rel.startsWith('commands/')) return 'command';
  if (rel.startsWith('agents/')) return 'agent';
  if (rel.startsWith('ace/workflows/')) return 'workflow';
  if (rel.startsWith('ace/references/')) return 'reference';
  if (rel.startsWith('ace/templates/')) return 'template';
  return null; // Not an ACE structural file
}

// ─── YAML frontmatter parsing ───

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const fields = {};
  const lines = match[1].split('\n');
  let currentKey = null;
  let inList = false;
  let listItems = [];

  for (const line of lines) {
    const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)/);
    if (kvMatch) {
      if (inList && currentKey) {
        fields[currentKey] = listItems;
        listItems = [];
        inList = false;
      }
      currentKey = kvMatch[1];
      const value = kvMatch[2].trim();
      if (value === '') {
        inList = true;
        listItems = [];
      } else {
        fields[currentKey] = value;
      }
    } else if (inList && line.match(/^\s+-\s+(.*)/)) {
      listItems.push(line.match(/^\s+-\s+(.*)/)[1].trim());
    }
  }
  if (inList && currentKey) {
    fields[currentKey] = listItems;
  }

  return fields;
}

function hasFrontmatter(content) {
  return /^---\n/.test(content);
}

// ─── Validation rules per file type ───

const COMMAND_REQUIRED_FRONTMATTER = ['name', 'description', 'allowed-tools'];
const COMMAND_REQUIRED_SECTIONS = ['<objective>', '<process>', '<success_criteria>'];

const AGENT_REQUIRED_FRONTMATTER = ['name', 'description', 'tools'];
const AGENT_REQUIRED_SECTIONS = ['<role>', '<execution_flow>', '<success_criteria>'];

const WORKFLOW_REQUIRED_SECTIONS = ['<purpose>'];

// Known XML tags that must be closed
const CLOSEABLE_TAGS = [
  'objective',
  'execution_context',
  'context',
  'process',
  'success_criteria',
  'role',
  'execution_flow',
  'step',
  'purpose',
  'core_principle',
  'overview',
  'required_reading',
  'task',
  'name',
  'files',
  'action',
  'verify',
  'done',
  'lifecycle',
  'size_constraint',
];

// ─── Validators ───

function validateCommand(filePath, content) {
  const fm = extractFrontmatter(content);

  if (!fm) {
    errors.push(`${filePath}: Command file missing YAML frontmatter`);
    return;
  }

  for (const field of COMMAND_REQUIRED_FRONTMATTER) {
    if (!fm[field]) {
      errors.push(`${filePath}: Missing required frontmatter field: ${field}`);
    }
  }

  if (fm.name && !/^ace\.[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(fm.name)) {
    errors.push(`${filePath}: Command name "${fm.name}" must match ace.kebab-case`);
  }

  for (const section of COMMAND_REQUIRED_SECTIONS) {
    if (!content.includes(section)) {
      errors.push(`${filePath}: Missing required section: ${section}`);
    }
  }
}

function validateAgent(filePath, content) {
  const fm = extractFrontmatter(content);

  if (!fm) {
    errors.push(`${filePath}: Agent file missing YAML frontmatter`);
    return;
  }

  for (const field of AGENT_REQUIRED_FRONTMATTER) {
    if (!fm[field]) {
      errors.push(`${filePath}: Missing required frontmatter field: ${field}`);
    }
  }

  if (fm.name && !/^ace-[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(fm.name)) {
    errors.push(`${filePath}: Agent name "${fm.name}" must match ace-kebab`);
  }

  for (const section of AGENT_REQUIRED_SECTIONS) {
    if (!content.includes(section)) {
      errors.push(`${filePath}: Missing required section: ${section}`);
    }
  }
}

function validateWorkflow(filePath, content) {
  if (hasFrontmatter(content)) {
    errors.push(`${filePath}: Workflow files must NOT have YAML frontmatter`);
  }

  for (const section of WORKFLOW_REQUIRED_SECTIONS) {
    if (!content.includes(section)) {
      warnings.push(`${filePath}: Missing recommended section: ${section}`);
    }
  }
}

function validateReference(filePath, content) {
  if (hasFrontmatter(content)) {
    errors.push(`${filePath}: Reference files must NOT have YAML frontmatter`);
  }
}

function validateTemplate(filePath, content) {
  if (hasFrontmatter(content)) {
    errors.push(`${filePath}: Template files must NOT have YAML frontmatter`);
  }
}

// ─── Cross-cutting validators (all file types) ───

function validateXmlTagClosure(filePath, content) {
  for (const tag of CLOSEABLE_TAGS) {
    const openPattern = new RegExp(`<${tag}[\\s>]`, 'g');
    const closePattern = new RegExp(`</${tag}>`, 'g');

    // Ignore content inside code blocks
    const contentOutsideCodeBlocks = content.replace(/```[\s\S]*?```/g, '');

    const openCount = (contentOutsideCodeBlocks.match(openPattern) || []).length;
    const closeCount = (contentOutsideCodeBlocks.match(closePattern) || []).length;

    if (openCount > closeCount) {
      errors.push(`${filePath}: Unclosed <${tag}> tag (${openCount} opened, ${closeCount} closed)`);
    }
  }
}

function validateStepNames(filePath, content) {
  const stepNamePattern = /name="([^"]+)"/g;
  let match;
  while ((match = stepNamePattern.exec(content)) !== null) {
    const name = match[1];
    if (!/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name)) {
      errors.push(`${filePath}: Step name "${name}" must be snake_case`);
    }
  }
}

function validateCrossReferences(filePath, content) {
  const refPattern = /@~\/\.claude\/([^\s)]+\.md)/g;
  let match;
  while ((match = refPattern.exec(content)) !== null) {
    const refPath = match[1];
    const localPath = path.join(ROOT, refPath);
    if (!fs.existsSync(localPath)) {
      warnings.push(`${filePath}: @-reference "${match[0]}" — file not found in project`);
    }
  }
}

// ─── Main ───

function validateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileType = getFileType(filePath);
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');

  if (!fileType) return;

  filesChecked++;

  switch (fileType) {
    case 'command':
      validateCommand(rel, content);
      break;
    case 'agent':
      validateAgent(rel, content);
      break;
    case 'workflow':
      validateWorkflow(rel, content);
      break;
    case 'reference':
      validateReference(rel, content);
      break;
    case 'template':
      validateTemplate(rel, content);
      break;
  }

  validateXmlTagClosure(rel, content);
  validateStepNames(rel, content);
  validateCrossReferences(rel, content);
}

function collectFiles(dir, ext) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', '.git', '.internal'].includes(entry.name)) {
      results.push(...collectFiles(fullPath, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

const args = process.argv.slice(2);
const filesToValidate =
  args.length > 0 ? args.filter((f) => f.endsWith('.md')) : collectFiles(ROOT, '.md');

for (const file of filesToValidate) {
  validateFile(path.resolve(file));
}

console.log(`\nACE Markdown Validator — ${filesChecked} files checked\n`);

if (warnings.length > 0) {
  console.log(`⚠ ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ${w}`);
  console.log('');
}

if (errors.length > 0) {
  console.log(`✗ ${errors.length} error(s):`);
  for (const e of errors) console.log(`  ${e}`);
  process.exit(1);
} else {
  console.log('✓ All files valid');
}
