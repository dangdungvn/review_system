const mysql = require('mysql2/promise');

const canonical = [
  ['Lập trình C++', 1],
  ['Lập trình di động', 1],
  ['Điện toán đám mây', 1],
  ['Cơ sở dữ liệu', 1],
  ['Phần mềm mã nguồn mở', 1],
  ['Cấu trúc dữ liệu và giải thuật', 1],
  ['Lập trình C cơ bản', 1],
  ['Nhập môn Xử lý ảnh', 2],
  ['Thương mại điện tử', 1],
];

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '123456',
    database: 'review_system',
  });

  await connection.beginTransaction();

  try {
    const [[user]] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      ['user@example.com'],
    );

    if (!user) {
      throw new Error('user@example.com not found');
    }

    const userId = user.id;
    const canonicalTitles = canonical.map(([title]) => title);
    const [beforeDocs] = await connection.query(
      'SELECT id, title FROM documents WHERE userId = ? ORDER BY id',
      [userId],
    );
    const junkIds = beforeDocs
      .filter((document) => !canonicalTitles.includes(document.title))
      .map((document) => document.id);
    const inserted = [];

    for (const [title] of canonical) {
      const [[existing]] = await connection.query(
        'SELECT id FROM documents WHERE userId = ? AND title = ? ORDER BY id LIMIT 1',
        [userId, title],
      );

      if (existing) continue;

      const now = new Date();
      const [result] = await connection.query(
        `INSERT INTO documents
          (title, originalFileName, filePath, markdownFilePath, fileSize, userId, extractedText, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          `${title}.pdf`,
          `canonical://${title}`,
          null,
          0,
          userId,
          `Tài liệu chuẩn cho môn ${title}.`,
          'completed',
          now,
          now,
        ],
      );
      inserted.push({ id: result.insertId, title });
    }

    const archiveTables = [
      'documents',
      'exams',
      'exam_questions',
      'flashcard_sets',
      'flashcards',
      'document_summaries',
      'true_false_quizzes',
      'user_exam_attempts',
      'user_answers',
      'user_flashcard_progress',
      'user_true_false_attempts',
    ];

    for (const table of archiveTables) {
      await connection.query(`CREATE TABLE IF NOT EXISTS archived_uttq_${table} LIKE ${table}`);
    }

    const archived = {};

    async function archiveWhere(table, where, params) {
      const [result] = await connection.query(
        `INSERT IGNORE INTO archived_uttq_${table} SELECT * FROM ${table} WHERE ${where}`,
        params,
      );
      archived[table] = result.affectedRows || 0;
    }

    if (junkIds.length > 0) {
      const junkPlaceholders = junkIds.map(() => '?').join(',');
      const [examRows] = await connection.query(
        `SELECT id FROM exams WHERE documentId IN (${junkPlaceholders})`,
        junkIds,
      );
      const examIds = examRows.map((row) => row.id);
      const [flashcardSetRows] = await connection.query(
        `SELECT id FROM flashcard_sets WHERE documentId IN (${junkPlaceholders})`,
        junkIds,
      );
      const flashcardSetIds = flashcardSetRows.map((row) => row.id);
      const [trueFalseRows] = await connection.query(
        `SELECT id FROM true_false_quizzes WHERE documentId IN (${junkPlaceholders})`,
        junkIds,
      );
      const trueFalseIds = trueFalseRows.map((row) => row.id);
      const [flashcardRows] = flashcardSetIds.length > 0
        ? await connection.query(
          `SELECT id FROM flashcards WHERE flashcardSetId IN (${flashcardSetIds.map(() => '?').join(',')})`,
          flashcardSetIds,
        )
        : [[]];
      const flashcardIds = flashcardRows.map((row) => row.id);
      const [attemptRows] = examIds.length > 0
        ? await connection.query(
          `SELECT id FROM user_exam_attempts WHERE userId = ? OR examId IN (${examIds.map(() => '?').join(',')})`,
          [userId, ...examIds],
        )
        : await connection.query('SELECT id FROM user_exam_attempts WHERE userId = ?', [userId]);
      const attemptIds = attemptRows.map((row) => row.id);

      await archiveWhere('documents', `id IN (${junkPlaceholders})`, junkIds);
      await archiveWhere('exams', `documentId IN (${junkPlaceholders})`, junkIds);
      if (examIds.length > 0) {
        await archiveWhere('exam_questions', `examId IN (${examIds.map(() => '?').join(',')})`, examIds);
      }
      await archiveWhere('flashcard_sets', `documentId IN (${junkPlaceholders})`, junkIds);
      if (flashcardSetIds.length > 0) {
        await archiveWhere('flashcards', `flashcardSetId IN (${flashcardSetIds.map(() => '?').join(',')})`, flashcardSetIds);
      }
      await archiveWhere('document_summaries', `documentId IN (${junkPlaceholders})`, junkIds);
      await archiveWhere('true_false_quizzes', `documentId IN (${junkPlaceholders})`, junkIds);
      await archiveWhere('user_exam_attempts', 'userId = ?', [userId]);
      if (attemptIds.length > 0) {
        await archiveWhere('user_answers', `attemptId IN (${attemptIds.map(() => '?').join(',')})`, attemptIds);
      }
      if (flashcardIds.length > 0) {
        await archiveWhere('user_flashcard_progress', `flashcardId IN (${flashcardIds.map(() => '?').join(',')})`, flashcardIds);
      }
      if (trueFalseIds.length > 0) {
        await archiveWhere('user_true_false_attempts', `quizId IN (${trueFalseIds.map(() => '?').join(',')})`, trueFalseIds);
      }

      await connection.query(
        `DELETE FROM documents WHERE userId = ? AND title NOT IN (${canonicalTitles.map(() => '?').join(',')})`,
        [userId, ...canonicalTitles],
      );
    }

    const [afterDocs] = await connection.query(
      `SELECT id, title, status, createdAt
       FROM documents
       WHERE userId = ?
       ORDER BY FIELD(title, ${canonicalTitles.map(() => '?').join(',')})`,
      [userId, ...canonicalTitles],
    );

    await connection.commit();
    console.log(JSON.stringify({ inserted, junkDeleted: junkIds.length, archived, afterDocs }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});