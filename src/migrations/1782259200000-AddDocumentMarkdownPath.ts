import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDocumentMarkdownPath1782259200000 implements MigrationInterface {
  name = 'AddDocumentMarkdownPath1782259200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const documentsTable = await queryRunner.getTable('documents');
    if (!documentsTable?.findColumnByName('markdownFilePath')) {
      await queryRunner.addColumn(
        'documents',
        new TableColumn({
          name: 'markdownFilePath',
          type: 'varchar',
          length: '500',
          isNullable: true,
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const documentsTable = await queryRunner.getTable('documents');
    if (documentsTable?.findColumnByName('markdownFilePath')) {
      await queryRunner.dropColumn('documents', 'markdownFilePath');
    }
  }
}
