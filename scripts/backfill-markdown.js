const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

loadEnvFile(path.resolve(process.cwd(), '.env'));

const markitdownBin = resolveMarkitdownBin();
const timeoutMs = Number(process.env.MARKITDOWN_TIMEOUT_MS || 120000);

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'review_system',
  });

  try {
    await ensureMarkdownColumn(connection);

    const [documents] = await connection.execute(
      `SELECT id, filePath
       FROM documents
       WHERE filePath IS NOT NULL
         AND LOWER(filePath) LIKE '%.pdf'`,
    );

    let converted = 0;
    let skipped = 0;
    let failed = 0;

    for (const document of documents) {
      const pdfPath = path.resolve(process.cwd(), document.filePath);
      if (!fs.existsSync(pdfPath)) {
        skipped += 1;
        console.warn(`Skip document #${document.id}: PDF not found`);
        continue;
      }

      const markdownFilePath = getMarkdownFilePath(document.filePath);
      const resolvedMarkdownPath = path.resolve(
        process.cwd(),
        markdownFilePath,
      );

      try {
        await fs.promises.mkdir(path.dirname(resolvedMarkdownPath), {
          recursive: true,
        });
        await runMarkitdown(pdfPath, resolvedMarkdownPath);
        const markdown = (
          await fs.promises.readFile(resolvedMarkdownPath, 'utf8')
        ).trim();
        if (!markdown) {
          throw new Error('MarkItDown produced empty Markdown output');
        }

        await connection.execute(
          `UPDATE documents
           SET extractedText = ?, markdownFilePath = ?, status = 'completed'
           WHERE id = ?`,
          [markdown, markdownFilePath, document.id],
        );

        converted += 1;
        console.log(`Converted document #${document.id}: ${markdownFilePath}`);
      } catch (error) {
        failed += 1;
        await fs.promises
          .rm(resolvedMarkdownPath, { force: true })
          .catch(() => {
            undefined;
          });
        await connection.execute(
          `UPDATE documents
           SET extractedText = NULL, markdownFilePath = NULL, status = 'failed'
           WHERE id = ?`,
          [document.id],
        );
        console.error(
          `Failed document #${document.id}: ${getErrorMessage(error)}`,
        );
      }
    }

    await convertLooseUploadPdfs(documents);

    console.log(
      `Done. converted=${converted}, skipped=${skipped}, failed=${failed}`,
    );
  } finally {
    await connection.end();
  }
}

async function ensureMarkdownColumn(connection) {
  const [columns] = await connection.execute(
    `SHOW COLUMNS FROM documents LIKE 'markdownFilePath'`,
  );
  if (columns.length > 0) {
    return;
  }

  await connection.execute(
    `ALTER TABLE documents ADD markdownFilePath varchar(500) NULL`,
  );
  console.log('Added documents.markdownFilePath column');
}

async function convertLooseUploadPdfs(documents) {
  const knownPaths = new Set(documents.map((document) => document.filePath));
  const uploadsPath = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsPath)) {
    return;
  }

  const files = await fs.promises.readdir(uploadsPath);
  for (const file of files) {
    if (path.extname(file).toLowerCase() !== '.pdf') {
      continue;
    }

    const relativePdfPath = path.join('uploads', file);
    if (knownPaths.has(relativePdfPath)) {
      continue;
    }

    const markdownFilePath = getMarkdownFilePath(relativePdfPath);
    const pdfPath = path.resolve(process.cwd(), relativePdfPath);
    const resolvedMarkdownPath = path.resolve(process.cwd(), markdownFilePath);
    if (fs.existsSync(resolvedMarkdownPath)) {
      continue;
    }

    try {
      await runMarkitdown(pdfPath, resolvedMarkdownPath);
      const markdown = (
        await fs.promises.readFile(resolvedMarkdownPath, 'utf8')
      ).trim();
      if (!markdown) {
        throw new Error('MarkItDown produced empty Markdown output');
      }
      console.log(`Converted loose PDF: ${markdownFilePath}`);
    } catch (error) {
      await fs.promises.rm(resolvedMarkdownPath, { force: true }).catch(() => {
        undefined;
      });
      console.error(
        `Failed loose PDF ${relativePdfPath}: ${getErrorMessage(error)}`,
      );
    }
  }
}

function getMarkdownFilePath(pdfPath) {
  const parsedPath = path.parse(pdfPath);
  return path.join(parsedPath.dir, `${parsedPath.name}.md`);
}

function runMarkitdown(pdfPath, markdownPath) {
  return new Promise((resolve, reject) => {
    execFile(
      markitdownBin,
      [pdfPath, '-o', markdownPath],
      {
        timeout:
          Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120000,
        maxBuffer: 20 * 1024 * 1024,
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      },
    );
  });
}

function resolveMarkitdownBin() {
  if (process.env.MARKITDOWN_BIN) {
    return process.env.MARKITDOWN_BIN;
  }

  const localBin = path.resolve(
    process.cwd(),
    '.venv-markitdown',
    'bin',
    'markitdown',
  );

  return fs.existsSync(localBin) ? localBin : 'markitdown';
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = rawValue.replace(/^["']|["']$/g, '');
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
});
