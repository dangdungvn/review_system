import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

const AI_CONTENT_TABLES = [
  {
    tableName: 'exams',
    indexName: 'IDX_exams_userId',
    foreignKeyName: 'FK_exams_userId_users_id',
  },
  {
    tableName: 'flashcard_sets',
    indexName: 'IDX_flashcard_sets_userId',
    foreignKeyName: 'FK_flashcard_sets_userId_users_id',
  },
  {
    tableName: 'document_summaries',
    indexName: 'IDX_document_summaries_userId',
    foreignKeyName: 'FK_document_summaries_userId_users_id',
  },
  {
    tableName: 'true_false_quizzes',
    indexName: 'IDX_true_false_quizzes_userId',
    foreignKeyName: 'FK_true_false_quizzes_userId_users_id',
  },
];

export class AddAiContentOwnership1783036800000
  implements MigrationInterface
{
  name = 'AddAiContentOwnership1783036800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const config of AI_CONTENT_TABLES) {
      await this.addOwnership(queryRunner, config);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const config of [...AI_CONTENT_TABLES].reverse()) {
      await this.dropOwnership(queryRunner, config);
    }
  }

  private async addOwnership(
    queryRunner: QueryRunner,
    config: {
      tableName: string;
      indexName: string;
      foreignKeyName: string;
    },
  ) {
    const table = await queryRunner.getTable(config.tableName);
    if (!table) {
      return;
    }

    if (!table.findColumnByName('userId')) {
      await queryRunner.addColumn(
        config.tableName,
        new TableColumn({
          name: 'userId',
          type: 'varchar',
          length: '36',
          isNullable: true,
        }),
      );
    }

    await queryRunner.query(
      `UPDATE ${config.tableName} content ` +
        'INNER JOIN documents document ON document.id = content.documentId ' +
        'SET content.userId = document.userId ' +
        'WHERE content.userId IS NULL',
    );

    const refreshedTable = await queryRunner.getTable(config.tableName);
    if (
      refreshedTable &&
      !refreshedTable.indices.some((index) => index.name === config.indexName)
    ) {
      await queryRunner.createIndex(
        config.tableName,
        new TableIndex({
          name: config.indexName,
          columnNames: ['userId'],
        }),
      );
    }

    const tableWithIndex = await queryRunner.getTable(config.tableName);
    if (
      tableWithIndex &&
      !tableWithIndex.foreignKeys.some(
        (foreignKey) => foreignKey.name === config.foreignKeyName,
      )
    ) {
      await queryRunner.createForeignKey(
        config.tableName,
        new TableForeignKey({
          name: config.foreignKeyName,
          columnNames: ['userId'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }
  }

  private async dropOwnership(
    queryRunner: QueryRunner,
    config: {
      tableName: string;
      indexName: string;
      foreignKeyName: string;
    },
  ) {
    const table = await queryRunner.getTable(config.tableName);
    if (!table) {
      return;
    }

    const foreignKey = table.foreignKeys.find(
      (key) => key.name === config.foreignKeyName,
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey(config.tableName, foreignKey);
    }

    const tableWithoutFk = await queryRunner.getTable(config.tableName);
    if (
      tableWithoutFk?.indices.some((index) => index.name === config.indexName)
    ) {
      await queryRunner.dropIndex(config.tableName, config.indexName);
    }

    const tableWithoutIndex = await queryRunner.getTable(config.tableName);
    if (tableWithoutIndex?.findColumnByName('userId')) {
      await queryRunner.dropColumn(config.tableName, 'userId');
    }
  }
}
