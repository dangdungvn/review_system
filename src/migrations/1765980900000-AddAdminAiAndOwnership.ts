import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddAdminAiAndOwnership1765980900000
  implements MigrationInterface
{
  name = 'AddAdminAiAndOwnership1765980900000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.addUsersIsActive(queryRunner);
    await this.addDocumentOwnership(queryRunner);
    await this.createAiSettings(queryRunner);
    await this.createAiGenerationLogs(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('ai_generation_logs', true);
    await queryRunner.dropTable('ai_settings', true);

    const documentsTable = await queryRunner.getTable('documents');
    const documentsUserIdFk = documentsTable?.foreignKeys.find(
      (foreignKey) => foreignKey.columnNames.length === 1 && foreignKey.columnNames[0] === 'userId',
    );
    if (documentsUserIdFk) {
      await queryRunner.dropForeignKey('documents', documentsUserIdFk);
    }
    if (documentsTable?.indices.some((index) => index.name === 'IDX_documents_userId')) {
      await queryRunner.dropIndex('documents', 'IDX_documents_userId');
    }
    if (documentsTable?.findColumnByName('userId')) {
      await queryRunner.dropColumn('documents', 'userId');
    }

    const usersTable = await queryRunner.getTable('users');
    if (usersTable?.findColumnByName('is_active')) {
      await queryRunner.dropColumn('users', 'is_active');
    }
  }

  private async addUsersIsActive(queryRunner: QueryRunner): Promise<void> {
    const usersTable = await queryRunner.getTable('users');
    if (!usersTable?.findColumnByName('is_active')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'is_active',
          type: 'tinyint',
          width: 1,
          isNullable: false,
          default: 1,
        }),
      );
    }
  }

  private async addDocumentOwnership(queryRunner: QueryRunner): Promise<void> {
    const documentsTable = await queryRunner.getTable('documents');
    if (!documentsTable?.findColumnByName('userId')) {
      await queryRunner.addColumn(
        'documents',
        new TableColumn({
          name: 'userId',
          type: 'varchar',
          length: '36',
          isNullable: true,
        }),
      );
    }

    const refreshedDocumentsTable = await queryRunner.getTable('documents');
    if (
      refreshedDocumentsTable &&
      !refreshedDocumentsTable.indices.some(
        (index) => index.name === 'IDX_documents_userId',
      )
    ) {
      await queryRunner.createIndex(
        'documents',
        new TableIndex({
          name: 'IDX_documents_userId',
          columnNames: ['userId'],
        }),
      );
    }

    const tableWithIndex = await queryRunner.getTable('documents');
    if (
      tableWithIndex &&
      !tableWithIndex.foreignKeys.some(
        (foreignKey) =>
          foreignKey.columnNames.length === 1 &&
          foreignKey.columnNames[0] === 'userId',
      )
    ) {
      await queryRunner.createForeignKey(
        'documents',
        new TableForeignKey({
          name: 'FK_documents_userId_users_id',
          columnNames: ['userId'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }
  }

  private async createAiSettings(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('ai_settings');
    if (hasTable) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'ai_settings',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'key',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          {
            name: 'value',
            type: 'longtext',
            isNullable: true,
          },
          {
            name: 'updated_at',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
          },
        ],
      }),
    );
  }

  private async createAiGenerationLogs(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const hasTable = await queryRunner.hasTable('ai_generation_logs');
    if (hasTable) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'ai_generation_logs',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
          },
          {
            name: 'contentType',
            type: 'enum',
            enum: ['exam', 'flashcards', 'summary', 'true_false'],
          },
          {
            name: 'documentId',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['success', 'failed'],
          },
          {
            name: 'model',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'inputChars',
            type: 'int',
          },
          {
            name: 'truncatedChars',
            type: 'int',
            default: 0,
          },
          {
            name: 'outputChars',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'durationMs',
            type: 'int',
          },
          {
            name: 'errorType',
            type: 'varchar',
            length: '80',
            isNullable: true,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
          },
        ],
        indices: [
          {
            name: 'IDX_ai_generation_logs_contentType',
            columnNames: ['contentType'],
          },
          {
            name: 'IDX_ai_generation_logs_documentId',
            columnNames: ['documentId'],
          },
          {
            name: 'IDX_ai_generation_logs_status',
            columnNames: ['status'],
          },
          {
            name: 'IDX_ai_generation_logs_created_at',
            columnNames: ['created_at'],
          },
        ],
      }),
    );
  }
}
