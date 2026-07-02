import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface MarkdownConversionResult {
  markdown: string;
  markdownFilePath: string;
}

interface MarkitdownCommand {
  file: string;
  args: string[];
}

interface WslPathInfo {
  distro: string;
  linuxPath: string;
}

@Injectable()
export class DocumentConversionService {
  private readonly logger = new Logger(DocumentConversionService.name);

  constructor(private readonly configService: ConfigService) {}

  async convertPdfToMarkdown(
    pdfPath: string,
  ): Promise<MarkdownConversionResult> {
    const markdownFilePath = this.getMarkdownFilePath(pdfPath);
    const resolvedPdfPath = path.resolve(pdfPath);
    const resolvedMarkdownPath = path.resolve(markdownFilePath);

    try {
      await fs.promises.mkdir(path.dirname(resolvedMarkdownPath), {
        recursive: true,
      });

      const command = this.resolveMarkitdownCommand(
        resolvedPdfPath,
        resolvedMarkdownPath,
      );

      await execFileAsync(command.file, command.args, {
        timeout: this.getTimeoutMs(),
        maxBuffer: 20 * 1024 * 1024,
      });

      const markdown = (
        await fs.promises.readFile(resolvedMarkdownPath, 'utf8')
      ).trim();

      if (!markdown) {
        throw new Error('MarkItDown produced empty Markdown output');
      }

      return {
        markdown,
        markdownFilePath,
      };
    } catch (error) {
      await fs.promises.rm(resolvedMarkdownPath, { force: true }).catch(() => {
        undefined;
      });
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(
        `Failed to convert PDF to Markdown with MarkItDown: ${errorMessage}`,
      );
      throw new ServiceUnavailableException(
        this.getUserFacingErrorMessage(errorMessage),
      );
    }
  }

  private getMarkdownFilePath(pdfPath: string) {
    const parsedPath = path.parse(pdfPath);
    return path.join(parsedPath.dir, `${parsedPath.name}.md`);
  }

  private resolveMarkitdownCommand(
    resolvedPdfPath: string,
    resolvedMarkdownPath: string,
  ): MarkitdownCommand {
    const configuredBin = this.configService.get<string>('MARKITDOWN_BIN');

    const wslCwd = this.toWslPath(process.cwd());
    const wslPdfPath = this.toWslPath(resolvedPdfPath);
    const wslMarkdownPath = this.toWslPath(resolvedMarkdownPath);

    if (
      process.platform === 'win32' &&
      wslCwd &&
      wslPdfPath &&
      wslMarkdownPath &&
      wslCwd.distro === wslPdfPath.distro &&
      wslCwd.distro === wslMarkdownPath.distro
    ) {
      const wslMarkitdownBin =
        configuredBin ||
        path.posix.join(
          wslCwd.linuxPath,
          '.venv-markitdown',
          'bin',
          'markitdown',
        );

      return {
        file: 'wsl.exe',
        args: [
          '-d',
          wslCwd.distro,
          '--cd',
          wslCwd.linuxPath,
          wslMarkitdownBin,
          wslPdfPath.linuxPath,
          '-o',
          wslMarkdownPath.linuxPath,
        ],
      };
    }

    if (configuredBin) {
      return {
        file: configuredBin,
        args: [resolvedPdfPath, '-o', resolvedMarkdownPath],
      };
    }

    const localBin = path.resolve(
      process.cwd(),
      '.venv-markitdown',
      'bin',
      'markitdown',
    );

    if (fs.existsSync(localBin)) {
      return {
        file: localBin,
        args: [resolvedPdfPath, '-o', resolvedMarkdownPath],
      };
    }

    return {
      file: 'markitdown',
      args: [resolvedPdfPath, '-o', resolvedMarkdownPath],
    };
  }

  private toWslPath(filePath: string): WslPathInfo | null {
    const normalizedPath = filePath.replace(/\//g, '\\');
    const match = normalizedPath.match(
      /^\\\\(?:wsl\.localhost|wsl\$)\\([^\\]+)\\(.+)$/i,
    );

    if (!match) {
      return null;
    }

    return {
      distro: match[1],
      linuxPath: `/${match[2].replace(/\\/g, '/')}`,
    };
  }

  private getTimeoutMs() {
    const configuredTimeout = Number(
      this.configService.get<string>('MARKITDOWN_TIMEOUT_MS'),
    );
    return Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : 120_000;
  }

  private getUserFacingErrorMessage(errorMessage: string) {
    if (errorMessage.includes('MarkItDown produced empty Markdown output')) {
      return 'Không thể trích xuất nội dung từ PDF này. File có thể là bản scan/ảnh và cần OCR trước khi chuyển sang Markdown.';
    }

    if (errorMessage.includes('ENOENT')) {
      return 'Không thể chạy MarkItDown. Vui lòng kiểm tra MarkItDown đã được cài và đường dẫn MARKITDOWN_BIN hợp lệ.';
    }

    return 'Không thể chuyển PDF sang Markdown. Vui lòng kiểm tra file PDF hoặc cấu hình MarkItDown.';
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}

