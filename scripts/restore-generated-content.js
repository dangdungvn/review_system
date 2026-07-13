const mysql = require('mysql2/promise');

const mappings = [
  { archivedDocumentId: 52, targetDocumentId: 2, reason: 'Android / lập trình di động' },
  { archivedDocumentId: 53, targetDocumentId: 3, reason: 'Điện toán đám mây' },
  { archivedDocumentId: 55, targetDocumentId: 4, reason: 'Truy vấn dữ liệu / cơ sở dữ liệu' },
  { archivedDocumentId: 56, targetDocumentId: 5, reason: 'Phần mềm mã nguồn mở' },
  { archivedDocumentId: 60, targetDocumentId: 8, reason: 'Xử lý ảnh - tổng ôn 1' },
  { archivedDocumentId: 61, targetDocumentId: 8, reason: 'Xử lý ảnh - tổng ôn 2' },
  { archivedDocumentId: 64, targetDocumentId: 9, reason: 'Thương mại điện tử' },
];

async function copyRows(connection, table, columns, whereColumn, sourceIds, overrides = {}) {
  if (sourceIds.length === 0) return 0;
  const selectColumns = columns.map((column) => {
    if (Object.prototype.hasOwnProperty.call(overrides, column)) {
      return '? AS `' + column + '`';
    }
    return '`' + column + '`';
  }).join(', ');
  const params = columns
    .filter((column) => Object.prototype.hasOwnProperty.call(overrides, column))
    .map((column) => overrides[column]);
  const [result] = await connection.query(
    `INSERT IGNORE INTO ${table} (${columns.map((column) => '`' + column + '`').join(', ')})
     SELECT ${selectColumns}
     FROM archived_uttq_${table}
     WHERE ${whereColumn} IN (${sourceIds.map(() => '?').join(',')})`,
    [...params, ...sourceIds],
  );
  return result.affectedRows || 0;
}

async function getColumns(connection, table) {
  const [rows] = await connection.query(`SHOW COLUMNS FROM ${table}`);
  return rows.map((row) => row.Field);
}

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
    const columns = {};
    for (const table of [
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
    ]) {
      columns[table] = await getColumns(connection, table);
    }

    const restored = [];

    for (const mapping of mappings) {
      const [examRows] = await connection.query(
        'SELECT id FROM archived_uttq_exams WHERE documentId = ?',
        [mapping.archivedDocumentId],
      );
      const examIds = examRows.map((row) => row.id);
      const [flashcardSetRows] = await connection.query(
        'SELECT id FROM archived_uttq_flashcard_sets WHERE documentId = ?',
        [mapping.archivedDocumentId],
      );
      const flashcardSetIds = flashcardSetRows.map((row) => row.id);
      const [flashcardRows] = flashcardSetIds.length > 0
        ? await connection.query(
          `SELECT id FROM archived_uttq_flashcards WHERE flashcardSetId IN (${flashcardSetIds.map(() => '?').join(',')})`,
          flashcardSetIds,
        )
        : [[]];
      const flashcardIds = flashcardRows.map((row) => row.id);
      const [tfRows] = await connection.query(
        'SELECT id FROM archived_uttq_true_false_quizzes WHERE documentId = ?',
        [mapping.archivedDocumentId],
      );
      const trueFalseIds = tfRows.map((row) => row.id);
      const [attemptRows] = examIds.length > 0
        ? await connection.query(
          `SELECT id FROM archived_uttq_user_exam_attempts WHERE examId IN (${examIds.map(() => '?').join(',')})`,
          examIds,
        )
        : [[]];
      const attemptIds = attemptRows.map((row) => row.id);

      const counts = {};
      counts.exams = await copyRows(connection, 'exams', columns.exams, 'documentId', [mapping.archivedDocumentId], { documentId: mapping.targetDocumentId });
      counts.examQuestions = examIds.length > 0
        ? await copyRows(connection, 'exam_questions', columns.exam_questions, 'examId', examIds)
        : 0;
      counts.flashcardSets = await copyRows(connection, 'flashcard_sets', columns.flashcard_sets, 'documentId', [mapping.archivedDocumentId], { documentId: mapping.targetDocumentId });
      counts.flashcards = flashcardSetIds.length > 0
        ? await copyRows(connection, 'flashcards', columns.flashcards, 'flashcardSetId', flashcardSetIds)
        : 0;
      counts.summaries = await copyRows(connection, 'document_summaries', columns.document_summaries, 'documentId', [mapping.archivedDocumentId], { documentId: mapping.targetDocumentId });
      counts.trueFalse = await copyRows(connection, 'true_false_quizzes', columns.true_false_quizzes, 'documentId', [mapping.archivedDocumentId], { documentId: mapping.targetDocumentId });
      counts.examAttempts = examIds.length > 0
        ? await copyRows(connection, 'user_exam_attempts', columns.user_exam_attempts, 'examId', examIds)
        : 0;
      counts.userAnswers = attemptIds.length > 0
        ? await copyRows(connection, 'user_answers', columns.user_answers, 'attemptId', attemptIds)
        : 0;
      counts.flashcardProgress = flashcardIds.length > 0
        ? await copyRows(connection, 'user_flashcard_progress', columns.user_flashcard_progress, 'flashcardId', flashcardIds)
        : 0;
      counts.trueFalseAttempts = trueFalseIds.length > 0
        ? await copyRows(connection, 'user_true_false_attempts', columns.user_true_false_attempts, 'quizId', trueFalseIds)
        : 0;

      restored.push({ ...mapping, counts });
    }

    const [active] = await connection.query(
      `SELECT d.id,d.title,
        COUNT(DISTINCT e.id) exams,
        COUNT(DISTINCT eq.id) questions,
        COUNT(DISTINCT fs.id) flashcardSets,
        COUNT(DISTINCT f.id) flashcards,
        COUNT(DISTINCT s.id) summaries,
        COUNT(DISTINCT tf.id) trueFalse
       FROM documents d
       LEFT JOIN exams e ON e.documentId=d.id
       LEFT JOIN exam_questions eq ON eq.examId=e.id
       LEFT JOIN flashcard_sets fs ON fs.documentId=d.id
       LEFT JOIN flashcards f ON f.flashcardSetId=fs.id
       LEFT JOIN document_summaries s ON s.documentId=d.id
       LEFT JOIN true_false_quizzes tf ON tf.documentId=d.id
       WHERE d.id BETWEEN 1 AND 9
       GROUP BY d.id,d.title
       ORDER BY d.id`,
    );

    await connection.commit();
    console.log(JSON.stringify({ restored, active }, null, 2));
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