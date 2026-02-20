#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// Colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';

// TTY / color detection
const noColor = 'NO_COLOR' in process.env || process.env.TERM === 'dumb' || 'CI' in process.env;
const useColor = !noColor && !!process.stdout.isTTY;
const useUnicode = useColor;

// Get version from package.json
const pkg = require('../package.json');

// Parse args
const args = process.argv.slice(2);
const hasGlobal = args.includes('--global') || args.includes('-g');
const hasLocal = args.includes('--local') || args.includes('-l');
const hasOpencode = args.includes('--opencode');
const hasClaude = args.includes('--claude');
const hasGemini = args.includes('--gemini');
const hasAll = args.includes('--all');
const hasUninstall = args.includes('--uninstall') || args.includes('-u');

// Runtime selection
let selectedRuntimes = [];
if (hasAll) {
  selectedRuntimes = ['claude', 'opencode', 'gemini'];
} else {
  if (hasOpencode) selectedRuntimes.push('opencode');
  if (hasClaude) selectedRuntimes.push('claude');
  if (hasGemini) selectedRuntimes.push('gemini');
}

// Helper to get directory name for a runtime
function getDirName(runtime) {
  if (runtime === 'opencode') return '.opencode';
  if (runtime === 'gemini') return '.gemini';
  return '.claude';
}

/**
 * Get the global config directory for OpenCode
 */
function getOpencodeGlobalDir() {
  if (process.env.OPENCODE_CONFIG_DIR) {
    return expandTilde(process.env.OPENCODE_CONFIG_DIR);
  }
  if (process.env.OPENCODE_CONFIG) {
    return path.dirname(expandTilde(process.env.OPENCODE_CONFIG));
  }
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(expandTilde(process.env.XDG_CONFIG_HOME), 'opencode');
  }
  return path.join(os.homedir(), '.config', 'opencode');
}

/**
 * Get the global config directory for a runtime
 */
function getGlobalDir(runtime, explicitDir = null) {
  if (runtime === 'opencode') {
    if (explicitDir) return expandTilde(explicitDir);
    return getOpencodeGlobalDir();
  }
  if (runtime === 'gemini') {
    if (explicitDir) return expandTilde(explicitDir);
    if (process.env.GEMINI_CONFIG_DIR) return expandTilde(process.env.GEMINI_CONFIG_DIR);
    return path.join(os.homedir(), '.gemini');
  }
  // Claude Code
  if (explicitDir) return expandTilde(explicitDir);
  if (process.env.CLAUDE_CONFIG_DIR) return expandTilde(process.env.CLAUDE_CONFIG_DIR);
  return path.join(os.homedir(), '.claude');
}

// Gradient banner
function buildBanner() {
  const logo = [
    '██████╗ ███████╗███╗   ██╗███╗   ██╗',
    '██╔══██╗██╔════╝████╗  ██║████╗  ██║',
    '██████╔╝█████╗  ██╔██╗ ██║██╔██╗ ██║',
    '██╔══██╗██╔══╝  ██║╚██╗██║██║╚██╗██║',
    '██║  ██║███████╗██║ ╚████║██║ ╚████║',
    '╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═══╝',
  ];

  const asciiLogo = [
    '  ____  _____ _   _ _   _',
    ' |  _ \\| ____| \\ | | \\ | |',
    ' | |_) |  _| |  \\| |  \\| |',
    ' |  _ <| |___| |\\  | |\\  |',
    ' |_| \\_\\_____|_| \\_|_| \\_|',
  ];

  // Row-based gradient from light pink to snow white
  const gradientColors = [
    '38;2;255;182;193', // light pink
    '38;2;255;192;203', // pink
    '38;2;255;209;220', // lighter pink
    '38;2;255;228;235', // very light pink
    '38;2;255;240;245', // near white
    '38;2;255;250;250', // snow white
  ];

  const lotus = useUnicode ? '\uD83C\uDF38 ' : '';

  const lines = [];
  lines.push('');

  if (useUnicode) {
    logo.forEach((line, i) => {
      const color = gradientColors[i % gradientColors.length];
      lines.push(useColor ? `  \x1b[${color}m${line}\x1b[0m` : `  ${line}`);
    });
  } else {
    asciiLogo.forEach((line) => lines.push(`  ${line}`));
  }

  lines.push('');
  lines.push(
    `  ${lotus}${dim}Grow ideas into shipped software${reset}  ${dim}v${pkg.version}${reset}`
  );
  lines.push('');

  return lines.join('\n');
}

const banner = buildBanner();

// Parse --config-dir argument
function parseConfigDirArg() {
  const configDirIndex = args.findIndex((arg) => arg === '--config-dir' || arg === '-c');
  if (configDirIndex !== -1) {
    const nextArg = args[configDirIndex + 1];
    if (!nextArg || nextArg.startsWith('-')) {
      console.error(`  ${yellow}--config-dir requires a path argument${reset}`);
      process.exit(1);
    }
    return nextArg;
  }
  const configDirArg = args.find((arg) => arg.startsWith('--config-dir=') || arg.startsWith('-c='));
  if (configDirArg) {
    const value = configDirArg.split('=')[1];
    if (!value) {
      console.error(`  ${yellow}--config-dir requires a non-empty path${reset}`);
      process.exit(1);
    }
    return value;
  }
  return null;
}
const explicitConfigDir = parseConfigDirArg();
const hasHelp = args.includes('--help') || args.includes('-h');
const forceStatusline = args.includes('--force-statusline');

// ─── CLI banner and help ───

if (require.main === module) {
  console.log(banner);

  // Show help if requested
  if (hasHelp) {
    console.log(
      `  ${yellow}Usage:${reset} npx renn [options]\n\n  ${yellow}Options:${reset}\n    ${cyan}-g, --global${reset}              Install globally (to config directory)\n    ${cyan}-l, --local${reset}               Install locally (to current directory)\n    ${cyan}--claude${reset}                  Install for Claude Code only\n    ${cyan}--opencode${reset}                Install for OpenCode only\n    ${cyan}--gemini${reset}                  Install for Gemini only\n    ${cyan}--all${reset}                     Install for all runtimes\n    ${cyan}-u, --uninstall${reset}           Uninstall RENN (remove all RENN files)\n    ${cyan}-c, --config-dir <path>${reset}   Specify custom config directory\n    ${cyan}-h, --help${reset}                Show this help message\n    ${cyan}--force-statusline${reset}        Replace existing statusline config\n\n  ${yellow}Examples:${reset}\n    ${dim}# Interactive install (prompts for runtime and location)${reset}\n    npx renn\n\n    ${dim}# Install for Claude Code globally${reset}\n    npx renn --claude --global\n\n    ${dim}# Install for all runtimes globally${reset}\n    npx renn --all --global\n\n    ${dim}# Install to custom config directory${reset}\n    npx renn --claude --global --config-dir ~/.claude-bc\n\n    ${dim}# Install to current project only${reset}\n    npx renn --claude --local\n\n    ${dim}# Uninstall RENN from Claude Code globally${reset}\n    npx renn --claude --global --uninstall\n`
    );
    process.exit(0);
  }
}

/**
 * Expand ~ to home directory
 */
function expandTilde(filePath) {
  if (filePath && filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Build a hook command path using forward slashes for cross-platform compatibility.
 */
function buildHookCommand(configDir, hookName) {
  const hooksPath = configDir.replace(/\\/g, '/') + '/hooks/' + hookName;
  return `node "${hooksPath}"`;
}

/**
 * Read and parse settings.json
 */
function readSettings(settingsPath) {
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (_e) {
      return {};
    }
  }
  return {};
}

/**
 * Write settings.json with proper formatting
 */
function writeSettings(settingsPath, settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

// Cache for attribution settings
const attributionCache = new Map();

/**
 * Get commit attribution setting for a runtime
 */
function getCommitAttribution(runtime) {
  if (attributionCache.has(runtime)) {
    return attributionCache.get(runtime);
  }

  let result;

  if (runtime === 'opencode') {
    const config = readSettings(path.join(getGlobalDir('opencode', null), 'opencode.json'));
    result = config.disable_ai_attribution === true ? null : undefined;
  } else if (runtime === 'gemini') {
    const settings = readSettings(
      path.join(getGlobalDir('gemini', explicitConfigDir), 'settings.json')
    );
    if (!settings.attribution || settings.attribution.commit === undefined) {
      result = undefined;
    } else if (settings.attribution.commit === '') {
      result = null;
    } else {
      result = settings.attribution.commit;
    }
  } else {
    const settings = readSettings(
      path.join(getGlobalDir('claude', explicitConfigDir), 'settings.json')
    );
    if (!settings.attribution || settings.attribution.commit === undefined) {
      result = undefined;
    } else if (settings.attribution.commit === '') {
      result = null;
    } else {
      result = settings.attribution.commit;
    }
  }

  attributionCache.set(runtime, result);
  return result;
}

/**
 * Process Co-Authored-By lines based on attribution setting
 */
function processAttribution(content, attribution) {
  if (attribution === null) {
    return content.replace(/(\r?\n){2}Co-Authored-By:.*$/gim, '');
  }
  if (attribution === undefined) {
    return content;
  }
  const safeAttribution = attribution.replace(/\$/g, '$$$$');
  return content.replace(/Co-Authored-By:.*$/gim, `Co-Authored-By: ${safeAttribution}`);
}

// Color name to hex mapping for opencode
const colorNameToHex = {
  cyan: '#00FFFF',
  red: '#FF0000',
  green: '#00FF00',
  blue: '#0000FF',
  yellow: '#FFFF00',
  magenta: '#FF00FF',
  orange: '#FFA500',
  purple: '#800080',
  pink: '#FFC0CB',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#808080',
  grey: '#808080',
};

// Tool name mapping from Claude Code to OpenCode
const claudeToOpencodeTools = {
  AskUserQuestion: 'question',
  SlashCommand: 'skill',
  TodoWrite: 'todowrite',
  WebFetch: 'webfetch',
  WebSearch: 'websearch',
};

// Tool name mapping from Claude Code to Gemini CLI
const claudeToGeminiTools = {
  Read: 'read_file',
  Write: 'write_file',
  Edit: 'replace',
  Bash: 'run_shell_command',
  Glob: 'glob',
  Grep: 'search_file_content',
  WebSearch: 'google_web_search',
  WebFetch: 'web_fetch',
  TodoWrite: 'write_todos',
  AskUserQuestion: 'ask_user',
};

/**
 * Convert a Claude Code tool name to OpenCode format
 */
function convertToolName(claudeTool) {
  if (claudeToOpencodeTools[claudeTool]) {
    return claudeToOpencodeTools[claudeTool];
  }
  if (claudeTool.startsWith('mcp__')) {
    return claudeTool;
  }
  return claudeTool.toLowerCase();
}

/**
 * Convert a Claude Code tool name to Gemini CLI format
 */
function convertGeminiToolName(claudeTool) {
  if (claudeTool.startsWith('mcp__')) return null;
  if (claudeTool === 'Task') return null;
  if (claudeToGeminiTools[claudeTool]) return claudeToGeminiTools[claudeTool];
  return claudeTool.toLowerCase();
}

/**
 * Strip HTML <sub> tags for Gemini CLI output
 */
function stripSubTags(content) {
  return content.replace(/<sub>(.*?)<\/sub>/g, '*($1)*');
}

/**
 * Convert Claude Code agent frontmatter to Gemini CLI format
 */
function convertClaudeToGeminiAgent(content) {
  if (!content.startsWith('---')) return content;

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) return content;

  const frontmatter = content.substring(3, endIndex).trim();
  const body = content.substring(endIndex + 3);

  const lines = frontmatter.split('\n');
  const newLines = [];
  let inAllowedTools = false;
  const tools = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('allowed-tools:')) {
      inAllowedTools = true;
      continue;
    }

    if (trimmed.startsWith('tools:')) {
      const toolsValue = trimmed.substring(6).trim();
      if (toolsValue) {
        const parsed = toolsValue
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t);
        for (const t of parsed) {
          const mapped = convertGeminiToolName(t);
          if (mapped) tools.push(mapped);
        }
      } else {
        inAllowedTools = true;
      }
      continue;
    }

    if (trimmed.startsWith('color:')) continue;

    if (inAllowedTools) {
      if (trimmed.startsWith('- ')) {
        const mapped = convertGeminiToolName(trimmed.substring(2).trim());
        if (mapped) tools.push(mapped);
        continue;
      } else if (trimmed && !trimmed.startsWith('-')) {
        inAllowedTools = false;
      }
    }

    if (!inAllowedTools) {
      newLines.push(line);
    }
  }

  if (tools.length > 0) {
    newLines.push('tools:');
    for (const tool of tools) {
      newLines.push(`  - ${tool}`);
    }
  }

  const newFrontmatter = newLines.join('\n').trim();
  return `---\n${newFrontmatter}\n---${stripSubTags(body)}`;
}

/**
 * Convert Claude Code frontmatter to OpenCode format
 */
function convertClaudeToOpencodeFrontmatter(content) {
  let convertedContent = content;
  convertedContent = convertedContent.replace(/\bAskUserQuestion\b/g, 'question');
  convertedContent = convertedContent.replace(/\bSlashCommand\b/g, 'skill');
  convertedContent = convertedContent.replace(/\bTodoWrite\b/g, 'todowrite');
  // Replace /renn.command with /renn-command for opencode (flat command structure)
  convertedContent = convertedContent.replace(/\/renn\./g, '/renn-');
  // Replace ~/.claude with ~/.config/opencode
  convertedContent = convertedContent.replace(/~\/\.claude\b/g, '~/.config/opencode');

  if (!convertedContent.startsWith('---')) return convertedContent;

  const endIndex = convertedContent.indexOf('---', 3);
  if (endIndex === -1) return convertedContent;

  const frontmatter = convertedContent.substring(3, endIndex).trim();
  const body = convertedContent.substring(endIndex + 3);

  const lines = frontmatter.split('\n');
  const newLines = [];
  let inAllowedTools = false;
  const allowedTools = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('allowed-tools:')) {
      inAllowedTools = true;
      continue;
    }

    if (trimmed.startsWith('tools:')) {
      const toolsValue = trimmed.substring(6).trim();
      if (toolsValue) {
        const tools = toolsValue
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t);
        allowedTools.push(...tools);
      }
      continue;
    }

    if (trimmed.startsWith('name:')) continue;

    if (trimmed.startsWith('color:')) {
      const colorValue = trimmed.substring(6).trim().toLowerCase();
      const hexColor = colorNameToHex[colorValue];
      if (hexColor) {
        newLines.push(`color: "${hexColor}"`);
      } else if (colorValue.startsWith('#') && /^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(colorValue)) {
        newLines.push(line);
      }
      continue;
    }

    if (inAllowedTools) {
      if (trimmed.startsWith('- ')) {
        allowedTools.push(trimmed.substring(2).trim());
        continue;
      } else if (trimmed && !trimmed.startsWith('-')) {
        inAllowedTools = false;
      }
    }

    if (!inAllowedTools) {
      newLines.push(line);
    }
  }

  if (allowedTools.length > 0) {
    newLines.push('tools:');
    for (const tool of allowedTools) {
      newLines.push(`  ${convertToolName(tool)}: true`);
    }
  }

  const newFrontmatter = newLines.join('\n').trim();
  return `---\n${newFrontmatter}\n---${body}`;
}

/**
 * Convert Claude Code markdown command to Gemini TOML format
 */
function convertClaudeToGeminiToml(content) {
  if (!content.startsWith('---')) {
    return `prompt = ${JSON.stringify(content)}\n`;
  }

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) {
    return `prompt = ${JSON.stringify(content)}\n`;
  }

  const frontmatter = content.substring(3, endIndex).trim();
  const body = content.substring(endIndex + 3).trim();

  let description = '';
  const lines = frontmatter.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('description:')) {
      description = trimmed.substring(12).trim();
      break;
    }
  }

  let toml = '';
  if (description) {
    toml += `description = ${JSON.stringify(description)}\n`;
  }
  toml += `prompt = ${JSON.stringify(body)}\n`;
  return toml;
}

/**
 * Copy renn.*.md commands to OpenCode's flat command/ directory
 * Converts renn.{name}.md → renn-{name}.md (dot to dash)
 */
function copyCommandsForOpencode(commandsSrc, destDir, pathPrefix, runtime) {
  if (!fs.existsSync(commandsSrc)) return;

  // Remove old renn-*.md files before copying new ones
  if (fs.existsSync(destDir)) {
    for (const file of fs.readdirSync(destDir)) {
      if (file.startsWith('renn-') && file.endsWith('.md')) {
        fs.unlinkSync(path.join(destDir, file));
      }
    }
  } else {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const entries = fs.readdirSync(commandsSrc);

  for (const file of entries) {
    if (!file.startsWith('renn.') || !file.endsWith('.md')) continue;

    const srcPath = path.join(commandsSrc, file);
    // renn.run-stage.md → renn-run-stage.md
    const destName = file.replace(/^renn\./, 'renn-');
    const destPath = path.join(destDir, destName);

    let content = fs.readFileSync(srcPath, 'utf8');
    content = content.replace(/~\/\.claude\//g, pathPrefix);
    content = content.replace(/~\/\.opencode\//g, pathPrefix);
    content = processAttribution(content, getCommitAttribution(runtime));
    content = convertClaudeToOpencodeFrontmatter(content);

    fs.writeFileSync(destPath, content);
  }
}

/**
 * Copy renn.*.md commands to Claude/Gemini commands/ directory
 */
function copyCommandFiles(commandsSrc, commandsDir, pathPrefix, runtime) {
  if (!fs.existsSync(commandsSrc)) return;

  fs.mkdirSync(commandsDir, { recursive: true });

  // Clean existing renn.*.md and renn.*.toml files before copying
  for (const file of fs.readdirSync(commandsDir)) {
    if (file.startsWith('renn.') && (file.endsWith('.md') || file.endsWith('.toml'))) {
      fs.unlinkSync(path.join(commandsDir, file));
    }
  }

  const entries = fs.readdirSync(commandsSrc);

  for (const file of entries) {
    if (!file.startsWith('renn.') || !file.endsWith('.md')) continue;

    const srcPath = path.join(commandsSrc, file);

    let content = fs.readFileSync(srcPath, 'utf8');
    content = content.replace(/~\/\.claude\//g, pathPrefix);
    content = processAttribution(content, getCommitAttribution(runtime));

    if (runtime === 'gemini') {
      content = stripSubTags(content);
      const tomlContent = convertClaudeToGeminiToml(content);
      const tomlName = file.replace(/\.md$/, '.toml');
      fs.writeFileSync(path.join(commandsDir, tomlName), tomlContent);
    } else {
      fs.writeFileSync(path.join(commandsDir, file), content);
    }
  }
}

/**
 * Recursively copy directory, replacing paths in .md files
 */
function copyWithPathReplacement(srcDir, destDir, pathPrefix, runtime) {
  const isOpencode = runtime === 'opencode';

  // Clean install: remove existing destination to prevent orphaned files
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true });
  }
  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyWithPathReplacement(srcPath, destPath, pathPrefix, runtime);
    } else if (entry.name.endsWith('.md')) {
      let content = fs.readFileSync(srcPath, 'utf8');
      const claudeDirRegex = /~\/\.claude\//g;
      content = content.replace(claudeDirRegex, pathPrefix);
      content = processAttribution(content, getCommitAttribution(runtime));

      if (isOpencode) {
        content = convertClaudeToOpencodeFrontmatter(content);
        fs.writeFileSync(destPath, content);
      } else if (runtime === 'gemini') {
        content = stripSubTags(content);
        const tomlContent = convertClaudeToGeminiToml(content);
        const tomlPath = destPath.replace(/\.md$/, '.toml');
        fs.writeFileSync(tomlPath, tomlContent);
      } else {
        fs.writeFileSync(destPath, content);
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Clean up orphaned files from previous RENN versions
 */
function cleanupOrphanedFiles(configDir) {
  const orphanedFiles = [
    // Add paths here as versions evolve
  ];

  for (const relPath of orphanedFiles) {
    const fullPath = path.join(configDir, relPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`  ${green}\u2713${reset} Removed orphaned ${relPath}`);
    }
  }
}

/**
 * Clean up orphaned hook registrations from settings.json
 */
function cleanupOrphanedHooks(settings) {
  const orphanedHookPatterns = [
    // Add patterns here as hook names change across versions
  ];

  if (orphanedHookPatterns.length === 0) return settings;

  let cleanedHooks = false;

  if (settings.hooks) {
    for (const eventType of Object.keys(settings.hooks)) {
      const hookEntries = settings.hooks[eventType];
      if (Array.isArray(hookEntries)) {
        const filtered = hookEntries.filter((entry) => {
          if (entry.hooks && Array.isArray(entry.hooks)) {
            const hasOrphaned = entry.hooks.some(
              (h) =>
                h.command && orphanedHookPatterns.some((pattern) => h.command.includes(pattern))
            );
            if (hasOrphaned) {
              cleanedHooks = true;
              return false;
            }
          }
          return true;
        });
        settings.hooks[eventType] = filtered;
      }
    }
  }

  if (cleanedHooks) {
    console.log(`  ${green}\u2713${reset} Removed orphaned hook registrations`);
  }

  return settings;
}

/**
 * Uninstall RENN from the specified directory for a specific runtime
 */
function uninstall(isGlobal, runtime = 'claude') {
  const isOpencode = runtime === 'opencode';
  const dirName = getDirName(runtime);

  const targetDir = isGlobal
    ? getGlobalDir(runtime, explicitConfigDir)
    : path.join(process.cwd(), dirName);

  const locationLabel = isGlobal
    ? targetDir.replace(os.homedir(), '~')
    : targetDir.replace(process.cwd(), '.');

  let runtimeLabel = 'Claude Code';
  if (runtime === 'opencode') runtimeLabel = 'OpenCode';
  if (runtime === 'gemini') runtimeLabel = 'Gemini';

  console.log(
    `  Uninstalling RENN from ${cyan}${runtimeLabel}${reset} at ${cyan}${locationLabel}${reset}\n`
  );

  if (!fs.existsSync(targetDir)) {
    console.log(`  ${yellow}\u26a0${reset} Directory does not exist: ${locationLabel}`);
    console.log(`  Nothing to uninstall.\n`);
    return;
  }

  let removedCount = 0;

  // 1. Remove RENN commands directory
  if (isOpencode) {
    const commandDir = path.join(targetDir, 'command');
    if (fs.existsSync(commandDir)) {
      const files = fs.readdirSync(commandDir);
      for (const file of files) {
        if (file.startsWith('renn-') && file.endsWith('.md')) {
          fs.unlinkSync(path.join(commandDir, file));
          removedCount++;
        }
      }
      console.log(`  ${green}\u2713${reset} Removed RENN commands from command/`);
    }
  } else {
    const commandsDir = path.join(targetDir, 'commands');
    if (fs.existsSync(commandsDir)) {
      for (const file of fs.readdirSync(commandsDir)) {
        if (file.startsWith('renn.') && (file.endsWith('.md') || file.endsWith('.toml'))) {
          fs.unlinkSync(path.join(commandsDir, file));
          removedCount++;
        }
      }
      console.log(`  ${green}\u2713${reset} Removed RENN commands from commands/`);
    }
  }

  // 2. Remove renn directory (workflows, templates, references)
  const rennDir = path.join(targetDir, 'renn');
  if (fs.existsSync(rennDir)) {
    fs.rmSync(rennDir, { recursive: true });
    removedCount++;
    console.log(`  ${green}\u2713${reset} Removed renn/`);
  }

  // 3. Remove RENN agents (renn-*.md files only)
  const agentsDir = path.join(targetDir, 'agents');
  if (fs.existsSync(agentsDir)) {
    const files = fs.readdirSync(agentsDir);
    let agentCount = 0;
    for (const file of files) {
      if (file.startsWith('renn-') && file.endsWith('.md')) {
        fs.unlinkSync(path.join(agentsDir, file));
        agentCount++;
      }
    }
    if (agentCount > 0) {
      removedCount++;
      console.log(`  ${green}\u2713${reset} Removed ${agentCount} RENN agents`);
    }
  }

  // 4. Remove RENN hooks
  const hooksDir = path.join(targetDir, 'hooks');
  if (fs.existsSync(hooksDir)) {
    const rennHooks = ['renn-statusline.js', 'renn-check-update.js'];
    let hookCount = 0;
    for (const hook of rennHooks) {
      const hookPath = path.join(hooksDir, hook);
      if (fs.existsSync(hookPath)) {
        fs.unlinkSync(hookPath);
        hookCount++;
      }
    }
    if (hookCount > 0) {
      removedCount++;
      console.log(`  ${green}\u2713${reset} Removed ${hookCount} RENN hooks`);
    }
  }

  // 5. Clean up settings.json
  const settingsPath = path.join(targetDir, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    const settings = readSettings(settingsPath);
    let settingsModified = false;

    // Remove RENN statusline
    if (
      settings.statusLine &&
      settings.statusLine.command &&
      settings.statusLine.command.includes('renn-statusline')
    ) {
      delete settings.statusLine;
      settingsModified = true;
      console.log(`  ${green}\u2713${reset} Removed RENN statusline from settings`);
    }

    // Remove RENN hooks from SessionStart
    if (settings.hooks && settings.hooks.SessionStart) {
      const before = settings.hooks.SessionStart.length;
      settings.hooks.SessionStart = settings.hooks.SessionStart.filter((entry) => {
        if (entry.hooks && Array.isArray(entry.hooks)) {
          const hasRennHook = entry.hooks.some(
            (h) =>
              h.command &&
              (h.command.includes('renn-check-update') || h.command.includes('renn-statusline'))
          );
          return !hasRennHook;
        }
        return true;
      });
      if (settings.hooks.SessionStart.length < before) {
        settingsModified = true;
        console.log(`  ${green}\u2713${reset} Removed RENN hooks from settings`);
      }
      if (settings.hooks.SessionStart.length === 0) delete settings.hooks.SessionStart;
      if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
    }

    if (settingsModified) {
      writeSettings(settingsPath, settings);
      removedCount++;
    }
  }

  // 6. For OpenCode, clean up permissions
  if (isOpencode) {
    const opencodeConfigDir = getOpencodeGlobalDir();
    const configPath = path.join(opencodeConfigDir, 'opencode.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        let modified = false;

        if (config.permission) {
          for (const permType of ['read', 'external_directory']) {
            if (config.permission[permType]) {
              const keys = Object.keys(config.permission[permType]);
              for (const key of keys) {
                if (key.includes('renn')) {
                  delete config.permission[permType][key];
                  modified = true;
                }
              }
              if (Object.keys(config.permission[permType]).length === 0) {
                delete config.permission[permType];
              }
            }
          }
          if (Object.keys(config.permission).length === 0) {
            delete config.permission;
          }
        }

        if (modified) {
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
          removedCount++;
          console.log(`  ${green}\u2713${reset} Removed RENN permissions from opencode.json`);
        }
      } catch (_e) {
        // Ignore JSON parse errors
      }
    }
  }

  if (removedCount === 0) {
    console.log(`  ${yellow}\u26a0${reset} No RENN files found to remove.`);
  }

  console.log(
    `\n  ${green}Done!${reset} RENN has been uninstalled from ${runtimeLabel}.\n  Your other files and settings have been preserved.\n`
  );
}

/**
 * Configure OpenCode permissions to allow reading RENN reference docs
 */
function configureOpencodePermissions() {
  const opencodeConfigDir = getOpencodeGlobalDir();
  const configPath = path.join(opencodeConfigDir, 'opencode.json');

  fs.mkdirSync(opencodeConfigDir, { recursive: true });

  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (_e) {
      console.log(`  ${yellow}\u26a0${reset} opencode.json had invalid JSON, recreating`);
    }
  }

  if (!config.permission) config.permission = {};

  const defaultConfigDir = path.join(os.homedir(), '.config', 'opencode');
  const rennPath =
    opencodeConfigDir === defaultConfigDir
      ? '~/.config/opencode/renn/*'
      : `${opencodeConfigDir}/renn/*`;

  let modified = false;

  if (!config.permission.read || typeof config.permission.read !== 'object') {
    config.permission.read = {};
  }
  if (config.permission.read[rennPath] !== 'allow') {
    config.permission.read[rennPath] = 'allow';
    modified = true;
  }

  if (
    !config.permission.external_directory ||
    typeof config.permission.external_directory !== 'object'
  ) {
    config.permission.external_directory = {};
  }
  if (config.permission.external_directory[rennPath] !== 'allow') {
    config.permission.external_directory[rennPath] = 'allow';
    modified = true;
  }

  if (!modified) return;

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`  ${green}\u2713${reset} Configured read permission for RENN docs`);
}

/**
 * Verify a directory exists and contains files
 */
function verifyInstalled(dirPath, description) {
  if (!fs.existsSync(dirPath)) {
    console.error(
      `  ${yellow}\u2717${reset} Failed to install ${description}: directory not created`
    );
    return false;
  }
  try {
    const entries = fs.readdirSync(dirPath);
    if (entries.length === 0) {
      console.error(
        `  ${yellow}\u2717${reset} Failed to install ${description}: directory is empty`
      );
      return false;
    }
  } catch (e) {
    console.error(`  ${yellow}\u2717${reset} Failed to install ${description}: ${e.message}`);
    return false;
  }
  return true;
}

/**
 * Verify a file exists
 */
function verifyFileInstalled(filePath, description) {
  if (!fs.existsSync(filePath)) {
    console.error(`  ${yellow}\u2717${reset} Failed to install ${description}: file not created`);
    return false;
  }
  return true;
}

/**
 * Install to the specified directory for a specific runtime
 */
function install(isGlobal, runtime = 'claude') {
  const isOpencode = runtime === 'opencode';
  const isGemini = runtime === 'gemini';
  const dirName = getDirName(runtime);
  const src = path.join(__dirname, '..');

  const targetDir = isGlobal
    ? getGlobalDir(runtime, explicitConfigDir)
    : path.join(process.cwd(), dirName);

  const locationLabel = isGlobal
    ? targetDir.replace(os.homedir(), '~')
    : targetDir.replace(process.cwd(), '.');

  const pathPrefix = isGlobal ? `${targetDir}/` : `./${dirName}/`;

  let runtimeLabel = 'Claude Code';
  if (isOpencode) runtimeLabel = 'OpenCode';
  if (isGemini) runtimeLabel = 'Gemini';

  console.log(
    `  Installing for ${cyan}${runtimeLabel}${reset} to ${cyan}${locationLabel}${reset}\n`
  );

  const failures = [];

  // Clean up orphaned files
  cleanupOrphanedFiles(targetDir);

  // Install commands
  if (isOpencode) {
    const commandDir = path.join(targetDir, 'command');
    fs.mkdirSync(commandDir, { recursive: true });

    const commandsSrc = path.join(src, 'commands');
    copyCommandsForOpencode(commandsSrc, commandDir, pathPrefix, runtime);
    if (verifyInstalled(commandDir, 'command/renn-*')) {
      const count = fs.readdirSync(commandDir).filter((f) => f.startsWith('renn-')).length;
      console.log(`  ${green}\u2713${reset} Installed ${count} commands to command/`);
    } else {
      failures.push('command/renn-*');
    }
  } else {
    const commandsDir = path.join(targetDir, 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });

    const commandsSrc = path.join(src, 'commands');
    copyCommandFiles(commandsSrc, commandsDir, pathPrefix, runtime);
    const count = fs
      .readdirSync(commandsDir)
      .filter((f) => f.startsWith('renn.') && (f.endsWith('.md') || f.endsWith('.toml'))).length;
    if (count > 0) {
      console.log(`  ${green}\u2713${reset} Installed ${count} commands`);
    } else {
      failures.push('commands');
    }
  }

  // Copy renn module (workflows, templates, references)
  const moduleSrc = path.join(src, 'renn');
  const moduleDest = path.join(targetDir, 'renn');
  copyWithPathReplacement(moduleSrc, moduleDest, pathPrefix, runtime);
  if (verifyInstalled(moduleDest, 'renn')) {
    console.log(`  ${green}\u2713${reset} Installed renn`);
  } else {
    failures.push('renn');
  }

  // Copy agents
  const agentsSrc = path.join(src, 'agents');
  if (fs.existsSync(agentsSrc)) {
    const agentsDest = path.join(targetDir, 'agents');
    fs.mkdirSync(agentsDest, { recursive: true });

    // Remove old RENN agents before copying new ones
    if (fs.existsSync(agentsDest)) {
      for (const file of fs.readdirSync(agentsDest)) {
        if (file.startsWith('renn-') && file.endsWith('.md')) {
          fs.unlinkSync(path.join(agentsDest, file));
        }
      }
    }

    const agentEntries = fs.readdirSync(agentsSrc, { withFileTypes: true });
    for (const entry of agentEntries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        let content = fs.readFileSync(path.join(agentsSrc, entry.name), 'utf8');
        const dirRegex = /~\/\.claude\//g;
        content = content.replace(dirRegex, pathPrefix);
        content = processAttribution(content, getCommitAttribution(runtime));
        if (isOpencode) {
          content = convertClaudeToOpencodeFrontmatter(content);
        } else if (isGemini) {
          content = convertClaudeToGeminiAgent(content);
        }
        fs.writeFileSync(path.join(agentsDest, entry.name), content);
      }
    }
    if (verifyInstalled(agentsDest, 'agents')) {
      console.log(`  ${green}\u2713${reset} Installed agents`);
    } else {
      failures.push('agents');
    }
  }

  // Write VERSION file
  const versionDest = path.join(targetDir, 'renn', 'VERSION');
  fs.writeFileSync(versionDest, pkg.version);
  if (verifyFileInstalled(versionDest, 'VERSION')) {
    console.log(`  ${green}\u2713${reset} Wrote VERSION (${pkg.version})`);
  } else {
    failures.push('VERSION');
  }

  // Copy hooks from dist/
  const hooksSrc = path.join(src, 'hooks', 'dist');
  if (fs.existsSync(hooksSrc)) {
    const hooksDest = path.join(targetDir, 'hooks');
    fs.mkdirSync(hooksDest, { recursive: true });
    const hookEntries = fs.readdirSync(hooksSrc);
    for (const entry of hookEntries) {
      const srcFile = path.join(hooksSrc, entry);
      if (fs.statSync(srcFile).isFile()) {
        const destFile = path.join(hooksDest, entry);
        fs.copyFileSync(srcFile, destFile);
      }
    }
    if (verifyInstalled(hooksDest, 'hooks')) {
      console.log(`  ${green}\u2713${reset} Installed hooks`);
    } else {
      failures.push('hooks');
    }
  }

  if (failures.length > 0) {
    console.error(`\n  ${yellow}Installation incomplete!${reset} Failed: ${failures.join(', ')}`);
    process.exit(1);
  }

  // Configure settings.json
  const settingsPath = path.join(targetDir, 'settings.json');
  const settings = cleanupOrphanedHooks(readSettings(settingsPath));
  const statuslineCommand = isGlobal
    ? buildHookCommand(targetDir, 'renn-statusline.js')
    : 'node ' + dirName + '/hooks/renn-statusline.js';
  const updateCheckCommand = isGlobal
    ? buildHookCommand(targetDir, 'renn-check-update.js')
    : 'node ' + dirName + '/hooks/renn-check-update.js';

  // Enable experimental agents for Gemini CLI
  if (isGemini) {
    if (!settings.experimental) settings.experimental = {};
    if (!settings.experimental.enableAgents) {
      settings.experimental.enableAgents = true;
      console.log(`  ${green}\u2713${reset} Enabled experimental agents`);
    }
  }

  // Configure SessionStart hook for update checking (skip for opencode)
  if (!isOpencode) {
    if (!settings.hooks) settings.hooks = {};
    if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];

    const hasRennUpdateHook = settings.hooks.SessionStart.some(
      (entry) =>
        entry.hooks && entry.hooks.some((h) => h.command && h.command.includes('renn-check-update'))
    );

    if (!hasRennUpdateHook) {
      settings.hooks.SessionStart.push({
        hooks: [
          {
            type: 'command',
            command: updateCheckCommand,
          },
        ],
      });
      console.log(`  ${green}\u2713${reset} Configured update check hook`);
    }
  }

  return { settingsPath, settings, statuslineCommand, runtime };
}

/**
 * Apply statusline config, then print completion message
 */
function finishInstall(
  settingsPath,
  settings,
  statuslineCommand,
  shouldInstallStatusline,
  runtime = 'claude'
) {
  const isOpencode = runtime === 'opencode';

  if (shouldInstallStatusline && !isOpencode) {
    settings.statusLine = {
      type: 'command',
      command: statuslineCommand,
    };
    console.log(`  ${green}\u2713${reset} Configured statusline`);
  }

  writeSettings(settingsPath, settings);

  if (isOpencode) {
    configureOpencodePermissions();
  }

  let program = 'Claude Code';
  if (runtime === 'opencode') program = 'OpenCode';
  if (runtime === 'gemini') program = 'Gemini';

  const command = isOpencode ? '/renn-help' : '/renn.help';
  console.log(`\n  ${green}Done!${reset} Launch ${program} and run ${cyan}${command}${reset}.\n`);
}

/**
 * Handle statusline configuration with optional prompt
 */
function handleStatusline(settings, isInteractive, callback) {
  const hasExisting = settings.statusLine != null;

  if (!hasExisting) {
    callback(true);
    return;
  }

  if (forceStatusline) {
    callback(true);
    return;
  }

  if (!isInteractive) {
    console.log(`  ${yellow}\u26a0${reset} Skipping statusline (already configured)`);
    console.log(`    Use ${cyan}--force-statusline${reset} to replace\n`);
    callback(false);
    return;
  }

  const existingCmd = settings.statusLine.command || settings.statusLine.url || '(custom)';

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(
    `\n  ${yellow}\u26a0${reset} Existing statusline detected\n\n  Your current statusline:\n    ${dim}command: ${existingCmd}${reset}\n\n  RENN includes a statusline showing:\n    \u2022 Model name\n    \u2022 Current task (from todo list)\n    \u2022 Context window usage (color-coded)\n\n  ${cyan}1${reset}) Keep existing\n  ${cyan}2${reset}) Replace with RENN statusline\n`
  );

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    rl.close();
    const choice = answer.trim() || '1';
    callback(choice === '2');
  });
}

/**
 * Prompt for runtime selection
 */
function promptRuntime(callback) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let answered = false;

  rl.on('close', () => {
    if (!answered) {
      answered = true;
      console.log(`\n  ${yellow}Installation cancelled${reset}\n`);
      process.exit(0);
    }
  });

  console.log(
    `  ${yellow}Which runtime(s) would you like to install for?${reset}\n\n  ${cyan}1${reset}) Claude Code ${dim}(~/.claude)${reset}\n  ${cyan}2${reset}) OpenCode    ${dim}(~/.config/opencode)${reset} - open source, free models\n  ${cyan}3${reset}) Gemini      ${dim}(~/.gemini)${reset}\n  ${cyan}4${reset}) All\n`
  );

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    answered = true;
    rl.close();
    const choice = answer.trim() || '1';
    if (choice === '4') {
      callback(['claude', 'opencode', 'gemini']);
    } else if (choice === '3') {
      callback(['gemini']);
    } else if (choice === '2') {
      callback(['opencode']);
    } else {
      callback(['claude']);
    }
  });
}

/**
 * Prompt for install location
 */
function promptLocation(runtimes) {
  if (!process.stdin.isTTY) {
    console.log(
      `  ${yellow}Non-interactive terminal detected, defaulting to global install${reset}\n`
    );
    installAllRuntimes(runtimes, true, false);
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let answered = false;

  rl.on('close', () => {
    if (!answered) {
      answered = true;
      console.log(`\n  ${yellow}Installation cancelled${reset}\n`);
      process.exit(0);
    }
  });

  const pathExamples = runtimes
    .map((r) => {
      const globalPath = getGlobalDir(r, explicitConfigDir);
      return globalPath.replace(os.homedir(), '~');
    })
    .join(', ');

  const localExamples = runtimes.map((r) => `./${getDirName(r)}`).join(', ');

  console.log(
    `  ${yellow}Where would you like to install?${reset}\n\n  ${cyan}1${reset}) Global ${dim}(${pathExamples})${reset} - available in all projects\n  ${cyan}2${reset}) Local  ${dim}(${localExamples})${reset} - this project only\n`
  );

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    answered = true;
    rl.close();
    const choice = answer.trim() || '1';
    const isGlobal = choice !== '2';
    installAllRuntimes(runtimes, isGlobal, true);
  });
}

/**
 * Install RENN for all selected runtimes
 */
function installAllRuntimes(runtimes, isGlobal, isInteractive) {
  const results = [];

  for (const runtime of runtimes) {
    const result = install(isGlobal, runtime);
    results.push(result);
  }

  const claudeResult = results.find((r) => r.runtime === 'claude');
  const geminiResult = results.find((r) => r.runtime === 'gemini');

  if (claudeResult || geminiResult) {
    const primaryResult = claudeResult || geminiResult;

    handleStatusline(primaryResult.settings, isInteractive, (shouldInstallStatusline) => {
      if (claudeResult) {
        finishInstall(
          claudeResult.settingsPath,
          claudeResult.settings,
          claudeResult.statuslineCommand,
          shouldInstallStatusline,
          'claude'
        );
      }
      if (geminiResult) {
        finishInstall(
          geminiResult.settingsPath,
          geminiResult.settings,
          geminiResult.statuslineCommand,
          shouldInstallStatusline,
          'gemini'
        );
      }

      const opencodeResult = results.find((r) => r.runtime === 'opencode');
      if (opencodeResult) {
        finishInstall(
          opencodeResult.settingsPath,
          opencodeResult.settings,
          opencodeResult.statuslineCommand,
          false,
          'opencode'
        );
      }
    });
  } else {
    const opencodeResult = results[0];
    finishInstall(
      opencodeResult.settingsPath,
      opencodeResult.settings,
      opencodeResult.statuslineCommand,
      false,
      'opencode'
    );
  }
}

// ─── CLI entry point ───

if (require.main === module) {
  if (hasGlobal && hasLocal) {
    console.error(`  ${yellow}Cannot specify both --global and --local${reset}`);
    process.exit(1);
  } else if (explicitConfigDir && hasLocal) {
    console.error(`  ${yellow}Cannot use --config-dir with --local${reset}`);
    process.exit(1);
  } else if (hasUninstall) {
    if (!hasGlobal && !hasLocal) {
      console.error(`  ${yellow}--uninstall requires --global or --local${reset}`);
      process.exit(1);
    }
    const runtimes = selectedRuntimes.length > 0 ? selectedRuntimes : ['claude'];
    for (const runtime of runtimes) {
      uninstall(hasGlobal, runtime);
    }
  } else if (selectedRuntimes.length > 0) {
    if (!hasGlobal && !hasLocal) {
      promptLocation(selectedRuntimes);
    } else {
      installAllRuntimes(selectedRuntimes, hasGlobal, false);
    }
  } else if (hasGlobal || hasLocal) {
    installAllRuntimes(['claude'], hasGlobal, false);
  } else {
    if (!process.stdin.isTTY) {
      console.log(
        `  ${yellow}Non-interactive terminal detected, defaulting to Claude Code global install${reset}\n`
      );
      installAllRuntimes(['claude'], true, false);
    } else {
      promptRuntime((runtimes) => {
        promptLocation(runtimes);
      });
    }
  }
}

// ─── Exports for testing ───

module.exports = {
  expandTilde,
  buildHookCommand,
  getDirName,
  getGlobalDir,
  getOpencodeGlobalDir,
  readSettings,
  writeSettings,
  processAttribution,
  convertToolName,
  convertGeminiToolName,
  stripSubTags,
  convertClaudeToGeminiAgent,
  convertClaudeToOpencodeFrontmatter,
  convertClaudeToGeminiToml,
  buildBanner,
  verifyInstalled,
  verifyFileInstalled,
  colorNameToHex,
  claudeToOpencodeTools,
  claudeToGeminiTools,
};
