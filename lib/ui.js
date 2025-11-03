const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m',
  bgCyan: '\x1b[46m',
};

const jarvis = {
  header: (text) => `${colors.bright}${colors.cyan}╔${'═'.repeat(text.length + 2)}╗\n║ ${text} ║\n╚${'═'.repeat(text.length + 2)}╝${colors.reset}`,
  box: (text) => `${colors.cyan}┌${'─'.repeat(text.length + 2)}┐\n│ ${text} │\n└${'─'.repeat(text.length + 2)}┘${colors.reset}`,
  success: (text) => `${colors.bright}${colors.green}✓${colors.reset} ${colors.green}${text}${colors.reset}`,
  error: (text) => `${colors.bright}${colors.red}✗${colors.reset} ${colors.red}${text}${colors.reset}`,
  warning: (text) => `${colors.bright}${colors.yellow}⚠${colors.reset} ${colors.yellow}${text}${colors.reset}`,
  info: (text) => `${colors.cyan}ℹ${colors.reset} ${colors.white}${text}${colors.reset}`,
  processing: (text) => `${colors.bright}${colors.blue}⚡${colors.reset} ${colors.blue}${text}${colors.reset}`,
  ai: (text) => `${colors.bright}${colors.magenta}🤖 JARVIS${colors.reset} ${colors.gray}»${colors.reset} ${colors.white}${text}${colors.reset}`,
  step: (num, text) => `${colors.bright}${colors.cyan}[${num}]${colors.reset} ${colors.white}${text}${colors.reset}`,
  divider: () => `${colors.dim}${colors.gray}${'─'.repeat(70)}${colors.reset}`,
  label: (key, value) => `${colors.dim}${key}:${colors.reset} ${colors.bright}${colors.white}${value}${colors.reset}`,
  timestamp: () => {
    const now = new Date();
    return `${colors.gray}[${now.toLocaleTimeString()}]${colors.reset}`;
  }
};

module.exports = { colors, jarvis };
