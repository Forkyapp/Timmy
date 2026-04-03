import { timmy, colors } from '../index';

describe('colors', () => {
  it('should export ANSI color codes', () => {
    expect(colors.reset).toBe('\x1b[0m');
    expect(colors.bright).toBe('\x1b[1m');
    expect(colors.dim).toBe('\x1b[2m');
    expect(colors.cyan).toBe('\x1b[36m');
    expect(colors.red).toBe('\x1b[31m');
    expect(colors.green).toBe('\x1b[32m');
    expect(colors.yellow).toBe('\x1b[33m');
    expect(colors.blue).toBe('\x1b[34m');
    expect(colors.magenta).toBe('\x1b[35m');
    expect(colors.white).toBe('\x1b[37m');
    expect(colors.gray).toBe('\x1b[90m');
  });

  it('should export background color codes', () => {
    expect(colors.bgBlue).toBe('\x1b[44m');
    expect(colors.bgGreen).toBe('\x1b[42m');
    expect(colors.bgYellow).toBe('\x1b[43m');
    expect(colors.bgRed).toBe('\x1b[41m');
    expect(colors.bgCyan).toBe('\x1b[46m');
    expect(colors.bgMagenta).toBe('\x1b[45m');
    expect(colors.bgBlack).toBe('\x1b[40m');
  });
});

describe('timmy', () => {
  describe('header', () => {
    it('should create a boxed header', () => {
      const result = timmy.header('Test');
      expect(result).toContain('Test');
      expect(result).toContain('╔');
      expect(result).toContain('╗');
      expect(result).toContain('╚');
      expect(result).toContain('╝');
      expect(result).toContain('═');
    });
  });

  describe('banner', () => {
    it('should return the ASCII art banner', () => {
      const result = timmy.banner();
      expect(result).toContain('████████╗');
      expect(result).toContain('Autonomous Task Automation System');
    });
  });

  describe('box', () => {
    it('should wrap text in a box', () => {
      const result = timmy.box('Hello');
      expect(result).toContain('Hello');
      expect(result).toContain('┌');
      expect(result).toContain('┐');
      expect(result).toContain('└');
      expect(result).toContain('┘');
      expect(result).toContain('─');
    });
  });

  describe('success', () => {
    it('should format success message with checkmark', () => {
      const result = timmy.success('Done');
      expect(result).toContain('✓');
      expect(result).toContain('Done');
      expect(result).toContain(colors.green);
    });
  });

  describe('error', () => {
    it('should format error message with cross', () => {
      const result = timmy.error('Failed');
      expect(result).toContain('✗');
      expect(result).toContain('Failed');
      expect(result).toContain(colors.red);
    });
  });

  describe('warning', () => {
    it('should format warning message', () => {
      const result = timmy.warning('Caution');
      expect(result).toContain('⚠');
      expect(result).toContain('Caution');
      expect(result).toContain(colors.yellow);
    });
  });

  describe('info', () => {
    it('should format info message', () => {
      const result = timmy.info('Note');
      expect(result).toContain('ℹ');
      expect(result).toContain('Note');
      expect(result).toContain(colors.cyan);
    });
  });

  describe('processing', () => {
    it('should format processing message', () => {
      const result = timmy.processing('Working');
      expect(result).toContain('⚡');
      expect(result).toContain('Working');
      expect(result).toContain(colors.blue);
    });
  });

  describe('ai', () => {
    it('should format AI message with robot emoji', () => {
      const result = timmy.ai('Thinking');
      expect(result).toContain('🤖');
      expect(result).toContain('TIMMY');
      expect(result).toContain('Thinking');
    });
  });

  describe('step', () => {
    it('should format step with number', () => {
      const result = timmy.step(1, 'First step');
      expect(result).toContain('[1]');
      expect(result).toContain('First step');
    });

    it('should handle different step numbers', () => {
      const result = timmy.step(5, 'Fifth step');
      expect(result).toContain('[5]');
      expect(result).toContain('Fifth step');
    });
  });

  describe('divider', () => {
    it('should return a line of dashes', () => {
      const result = timmy.divider();
      expect(result).toContain('─');
    });
  });

  describe('doubleDivider', () => {
    it('should return a line of double dashes', () => {
      const result = timmy.doubleDivider();
      expect(result).toContain('═');
    });
  });

  describe('label', () => {
    it('should format key-value pair', () => {
      const result = timmy.label('Name', 'Timmy');
      expect(result).toContain('Name:');
      expect(result).toContain('Timmy');
    });
  });

  describe('dim', () => {
    it('should apply dim styling', () => {
      const result = timmy.dim('faded text');
      expect(result).toContain('faded text');
      expect(result).toContain(colors.dim);
      expect(result).toContain(colors.gray);
    });
  });

  describe('timestamp', () => {
    it('should return a formatted timestamp', () => {
      const result = timmy.timestamp();
      expect(result).toContain('[');
      expect(result).toContain(']');
      expect(result).toContain(colors.gray);
    });
  });

  describe('spinner', () => {
    it('should start and stop a spinner', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      const spinner = timmy.spinner.start('Loading');
      expect(writeSpy).toHaveBeenCalled();

      spinner.stop();

      writeSpy.mockRestore();
      logSpy.mockRestore();
    });

    it('should update spinner text', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      const spinner = timmy.spinner.start('Loading');
      spinner.update('Still loading');
      spinner.stop();

      writeSpy.mockRestore();
      logSpy.mockRestore();
    });

    it('should succeed with message', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      const spinner = timmy.spinner.start('Loading');
      spinner.succeed('Done!');

      expect(logSpy).toHaveBeenCalled();

      writeSpy.mockRestore();
      logSpy.mockRestore();
    });

    it('should fail with message', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      const spinner = timmy.spinner.start('Loading');
      spinner.fail('Error!');

      expect(logSpy).toHaveBeenCalled();

      writeSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  describe('progressBar', () => {
    it('should render progress bar at 0%', () => {
      const result = timmy.progressBar(0, 100);
      expect(result).toContain('0%');
      expect(result).toContain('(0/100)');
      expect(result).toContain('░');
    });

    it('should render progress bar at 50%', () => {
      const result = timmy.progressBar(50, 100);
      expect(result).toContain('50%');
      expect(result).toContain('(50/100)');
      expect(result).toContain('█');
    });

    it('should render progress bar at 100%', () => {
      const result = timmy.progressBar(100, 100);
      expect(result).toContain('100%');
      expect(result).toContain('(100/100)');
    });

    it('should clamp values above 100%', () => {
      const result = timmy.progressBar(150, 100);
      expect(result).toContain('100%');
    });

    it('should accept custom width', () => {
      const result = timmy.progressBar(50, 100, 20);
      expect(result).toContain('50%');
    });
  });

  describe('badge', () => {
    it('should create badge with color', () => {
      const result = timmy.badge('OK', 'green');
      expect(result).toContain('OK');
      expect(result).toContain(colors.green);
    });

    it('should work with different colors', () => {
      const colorTests: Array<'green' | 'blue' | 'yellow' | 'red' | 'magenta' | 'cyan'> = [
        'green', 'blue', 'yellow', 'red', 'magenta', 'cyan',
      ];
      for (const color of colorTests) {
        const result = timmy.badge('test', color);
        expect(result).toContain(colors[color]);
      }
    });
  });

  describe('section', () => {
    it('should create section with title', () => {
      const result = timmy.section('My Section');
      expect(result).toContain('My Section');
      expect(result).toContain('▌');
      expect(result).toContain('─');
    });
  });

  describe('card', () => {
    it('should create card with title and items', () => {
      const result = timmy.card('Status', [
        { key: 'State', value: 'Running' },
        { key: 'Uptime', value: '5m' },
      ]);
      expect(result).toContain('Status');
      expect(result).toContain('State:');
      expect(result).toContain('Running');
      expect(result).toContain('Uptime:');
      expect(result).toContain('5m');
      expect(result).toContain('╭');
      expect(result).toContain('╰');
    });

    it('should handle items with icons', () => {
      const result = timmy.card('Info', [
        { key: 'Name', value: 'Timmy', icon: '🤖' },
      ]);
      expect(result).toContain('🤖');
      expect(result).toContain('Name:');
      expect(result).toContain('Timmy');
    });
  });

  describe('statusIndicator', () => {
    it('should show online status', () => {
      const result = timmy.statusIndicator('Server', 'online');
      expect(result).toContain('●');
      expect(result).toContain('Server');
      expect(result).toContain(colors.green);
    });

    it('should show offline status', () => {
      const result = timmy.statusIndicator('Server', 'offline');
      expect(result).toContain('●');
      expect(result).toContain(colors.red);
    });

    it('should show idle status', () => {
      const result = timmy.statusIndicator('Worker', 'idle');
      expect(result).toContain('○');
      expect(result).toContain(colors.yellow);
    });

    it('should show processing status', () => {
      const result = timmy.statusIndicator('Task', 'processing');
      expect(result).toContain('◐');
      expect(result).toContain(colors.blue);
    });

    it('should include description when provided', () => {
      const result = timmy.statusIndicator('Server', 'online', 'All systems go');
      expect(result).toContain('All systems go');
    });
  });

  describe('pipeline', () => {
    it('should render pipeline stages', () => {
      const result = timmy.pipeline([
        { label: 'Analysis', color: 'cyan' },
        { label: 'Implementation', color: 'blue' },
        { label: 'Review', color: 'green' },
      ]);
      expect(result).toContain('Analysis');
      expect(result).toContain('Implementation');
      expect(result).toContain('Review');
      expect(result).toContain('→');
    });

    it('should not add arrow after last stage', () => {
      const result = timmy.pipeline([
        { label: 'Only Stage', color: 'green' },
      ]);
      expect(result).toContain('Only Stage');
      expect(result).not.toContain('→');
    });

    it('should handle unknown color gracefully', () => {
      const result = timmy.pipeline([
        { label: 'Test', color: 'nonexistent' },
      ]);
      expect(result).toContain('Test');
    });
  });
});
