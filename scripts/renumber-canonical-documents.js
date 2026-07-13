const mysql = require('mysql2/promise');

const canonical = [
  ['Lập trình C++', 1],
  ['Lập trình di động', 2],
  ['Điện toán đám mây', 3],
  ['Cơ sở dữ liệu', 4],
  ['Phần mềm mã nguồn mở', 5],
  ['Cấu trúc dữ liệu và giải thuật', 6],
  ['Lập trình C cơ bản', 7],
  ['Nhập môn Xử lý ảnh', 8],
  ['Thương mại điện tử', 9],
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
    const [[user]] = await connection.query('SELECT id FROM users WHERE email = ?', ['user@example.com']);
    if (!user) throw new Error('user@example.com not found');

    const [occupied] = await connection.query(
      'SELECT id, title, userId FROM documents WHERE id BETWEEN 1 AND 9 AND userId <> ? ORDER BY id',
      [user.id],
    );
    if (occupied.length > 0) {
      throw new Error(`Cannot renumber: document ids 1-9 are occupied by another user: ${JSON.stringify(occupied)}`);
    }

    const [canonicalRows] = await connection.query(
      `SELECT id, title FROM documents WHERE userId = ? AND title IN (${canonical.map(() => '?').join(',')})`,
      [user.id, ...canonical.map(([title]) => title)],
    );

    const currentByTitle = new Map(canonicalRows.map((row) => [row.title, row.id]));
    const missing = canonical.filter(([title]) => !currentByTitle.has(title)).map(([title]) => title);
    if (missing.length > 0) {
      throw new Error(`Cannot renumber: missing canonical documents: ${missing.join(', ')}`);
    }

    const mappings = canonical
      .map(([title, targetId]) => ({ title, currentId: currentByTitle.get(title), targetId }))
      .filter((mapping) => mapping.currentId !== mapping.targetId);

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const { currentId, targetId } of mappings) {
      await connection.query('UPDATE documents SET id = ? WHERE id = ?', [targetId, currentId]);
      await connection.query('UPDATE exams SET documentId = ? WHERE documentId = ?', [targetId, currentId]);
      await connection.query('UPDATE flashcard_sets SET documentId = ? WHERE documentId = ?', [targetId, currentId]);
      await connection.query('UPDATE document_summaries SET documentId = ? WHERE documentId = ?', [targetId, currentId]);
      await connection.query('UPDATE true_false_quizzes SET documentId = ? WHERE documentId = ?', [targetId, currentId]);
      await connection.query('UPDATE ai_generation_logs SET documentId = ? WHERE documentId = ?', [targetId, currentId]);
    }

    await connection.query('ALTER TABLE documents AUTO_INCREMENT = 10');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    const [afterDocs] = await connection.query(
      'SELECT id, title, status, userId FROM documents WHERE userId = ? ORDER BY id',
      [user.id],
    );
    const [childRefs] = await connection.query(
      `SELECT 'exams' tableName, COUNT(*) total FROM exams WHERE documentId BETWEEN 1 AND 9
       UNION ALL SELECT 'flashcard_sets', COUNT(*) FROM flashcard_sets WHERE documentId BETWEEN 1 AND 9
       UNION ALL SELECT 'document_summaries', COUNT(*) FROM document_summaries WHERE documentId BETWEEN 1 AND 9
       UNION ALL SELECT 'true_false_quizzes', COUNT(*) FROM true_false_quizzes WHERE documentId BETWEEN 1 AND 9`,
    );

    await connection.commit();
    console.log(JSON.stringify({ mappings, afterDocs, childRefs }, null, 2));
  } catch (error) {
    try {
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch {}
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