import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AdminAiContentService } from './admin-ai-content.service';
import { AdminAiMonitoringService } from './admin-ai-monitoring.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDocumentsService } from './admin-documents.service';
import { AdminUsersService } from './admin-users.service';
import { AdminAiContentQueryDto } from './dto/admin-ai-content-query.dto';
import { AdminDocumentQueryDto } from './dto/admin-document-query.dto';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import {
  UpdateExamDto,
  UpdateExamQuestionDto,
  UpdateFlashcardDto,
  UpdateFlashcardSetDto,
  UpdateSummaryDto,
  UpdateTrueFalseDto,
} from './dto/update-ai-content.dto';
import {
  AdminAiLogQueryDto,
  UpdateAiApiKeyDto,
  UpdateAiSettingsDto,
} from './dto/admin-ai-monitoring.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@ApiTags('Admin')
@ApiBearerAuth('JWT')
@Controller('admin')
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly adminDashboardService: AdminDashboardService,
    private readonly adminDocumentsService: AdminDocumentsService,
    private readonly adminAiContentService: AdminAiContentService,
    private readonly adminAiMonitoringService: AdminAiMonitoringService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Kiểm tra thông tin admin hiện tại' })
  getCurrentAdmin(@CurrentUser() user: any) {
    return {
      id: user.id ?? user.userId,
      email: user.email,
      role: user.role,
    };
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard tổng quan hệ thống' })
  getDashboard() {
    return this.adminDashboardService.getOverview();
  }

  @Get('ai/logs')
  @ApiOperation({ summary: 'Log các lần generate AI' })
  findAiLogs(@Query() query: AdminAiLogQueryDto) {
    return this.adminAiMonitoringService.findLogs(query);
  }

  @Get('ai/stats')
  @ApiOperation({ summary: 'Thống kê số lần gọi AI, thời gian xử lý, lỗi parsing' })
  getAiStats(@Query() query: AdminAiLogQueryDto) {
    return this.adminAiMonitoringService.getStats(query);
  }

  @Get('ai/settings')
  @ApiOperation({ summary: 'Xem cấu hình AI hiện tại, không trả API key thô' })
  getAiSettings() {
    return this.adminAiMonitoringService.getSettings();
  }

  @Patch('ai/settings')
  @ApiOperation({ summary: 'Cấu hình model, prompt và giới hạn generate' })
  updateAiSettings(@Body() dto: UpdateAiSettingsDto) {
    return this.adminAiMonitoringService.updateSettings(dto);
  }

  @Patch('ai/settings/api-key')
  @ApiOperation({ summary: 'Đổi API key AI Gemini' })
  updateAiApiKey(@Body() dto: UpdateAiApiKeyDto) {
    return this.adminAiMonitoringService.updateApiKey(dto);
  }

  @Get('documents')
  @ApiOperation({
    summary: 'Xem tất cả tài liệu, lọc theo trạng thái/ngày/kích thước',
  })
  findDocuments(@Query() query: AdminDocumentQueryDto) {
    return this.adminDocumentsService.findAll(query);
  }

  @Get('documents/:id')
  @ApiOperation({ summary: 'Chi tiết tài liệu, bao gồm extracted text' })
  findDocument(@Param('id', ParseIntPipe) id: number) {
    return this.adminDocumentsService.findOne(id);
  }

  @Post('documents/:id/retry')
  @ApiOperation({ summary: 'Retry xử lý PDF nếu tài liệu đang failed' })
  retryDocumentProcessing(@Param('id', ParseIntPipe) id: number) {
    return this.adminDocumentsService.retryProcessing(id);
  }

  @Delete('documents/:id')
  @ApiOperation({
    summary: 'Xóa tài liệu và toàn bộ nội dung phát sinh liên quan',
  })
  removeDocument(@Param('id', ParseIntPipe) id: number) {
    return this.adminDocumentsService.remove(id);
  }

  @Get('ai-content/exams')
  @ApiOperation({ summary: 'Danh sách đề thi AI đã tạo' })
  findExams(@Query() query: AdminAiContentQueryDto) {
    return this.adminAiContentService.findExams(query);
  }

  @Get('ai-content/exams/:id')
  @ApiOperation({ summary: 'Chi tiết đề thi kèm câu hỏi' })
  findExam(@Param('id', ParseIntPipe) id: number) {
    return this.adminAiContentService.findExam(id);
  }

  @Patch('ai-content/exams/:id')
  @ApiOperation({ summary: 'Sửa thông tin đề thi' })
  updateExam(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExamDto,
  ) {
    return this.adminAiContentService.updateExam(id, dto);
  }

  @Post('ai-content/exams/:id/retry')
  @ApiOperation({ summary: 'Retry generate đề thi nếu lỗi hoặc nội dung kém' })
  retryExam(@Param('id', ParseIntPipe) id: number) {
    return this.adminAiContentService.retryExam(id);
  }

  @Delete('ai-content/exams/:id')
  @ApiOperation({ summary: 'Xóa đề thi và câu hỏi liên quan' })
  removeExam(@Param('id', ParseIntPipe) id: number) {
    return this.adminAiContentService.removeExam(id);
  }

  @Patch('ai-content/exam-questions/:id')
  @ApiOperation({ summary: 'Sửa câu hỏi, đáp án, giải thích của đề thi' })
  updateExamQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExamQuestionDto,
  ) {
    return this.adminAiContentService.updateExamQuestion(id, dto);
  }

  @Get('ai-content/exam-questions/:id')
  @ApiOperation({ summary: 'Chi tiết một câu hỏi trong đề thi' })
  findExamQuestion(@Param('id', ParseIntPipe) id: number) {
    return this.adminAiContentService.findExamQuestion(id);
  }

  @Delete('ai-content/exam-questions/:id')
  @ApiOperation({ summary: 'Xóa một câu hỏi trong đề thi' })
  removeExamQuestion(@Param('id', ParseIntPipe) id: number) {
    return this.adminAiContentService.removeExamQuestion(id);
  }

  @Get('ai-content/flashcard-sets')
  @ApiOperation({ summary: 'Danh sách bộ flashcard AI đã tạo' })
  findFlashcardSets(@Query() query: AdminAiContentQueryDto) {
    return this.adminAiContentService.findFlashcardSets(query);
  }

  @Get('ai-content/flashcard-sets/:id')
  @ApiOperation({ summary: 'Chi tiết bộ flashcard kèm cards' })
  findFlashcardSet(@Param('id', ParseIntPipe) id: number) {
    return this.adminAiContentService.findFlashcardSet(id);
  }

  @Patch('ai-content/flashcard-sets/:id')
  @ApiOperation({ summary: 'Sửa thông tin bộ flashcard' })
  updateFlashcardSet(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFlashcardSetDto,
  ) {
    return this.adminAiContentService.updateFlashcardSet(id, dto);
  }

  @Post('ai-content/flashcard-sets/:id/retry')
  @ApiOperation({ summary: 'Retry generate flashcards nếu lỗi hoặc nội dung kém' })
  retryFlashcardSet(@Param('id', ParseIntPipe) id: number) {
    return this.adminAiContentService.retryFlashcardSet(id);
  }

  @Delete('ai-content/flashcard-sets/:id')
  @ApiOperation({ summary: 'Xóa bộ flashcard và các card liên quan' })
  removeFlashcardSet(@Param('id', ParseIntPipe) id: number) {
    return this.adminAiContentService.removeFlashcardSet(id);
  }

  @Patch('ai-content/flashcards/:id')
  @ApiOperation({ summary: 'Sửa flashcard' })
  updateFlashcard(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFlashcardDto,
  ) {
    return this.adminAiContentService.updateFlashcard(id, dto);
  }

  @Get('ai-content/flashcards/:id')
  @ApiOperation({ summary: 'Chi tiết một flashcard' })
  findFlashcard(@Param('id', ParseIntPipe) id: number) {
    return this.adminAiContentService.findFlashcard(id);
  }

  @Delete('ai-content/flashcards/:id')
  @ApiOperation({ summary: 'Xóa flashcard' })
  removeFlashcard(@Param('id', ParseIntPipe) id: number) {
    return this.adminAiContentService.removeFlashcard(id);
  }

  @Get('ai-content/summaries')
  @ApiOperation({ summary: 'Danh sách summary AI đã tạo' })
  findSummaries(@Query() query: AdminAiContentQueryDto) {
    return this.adminAiContentService.findSummaries(query);
  }

  @Get('ai-content/summaries/:id')
  @ApiOperation({ summary: 'Chi tiết summary' })
  findSummary(@Param('id', ParseIntPipe) id: number) {
    return this.adminAiContentService.findSummary(id);
  }

  @Patch('ai-content/summaries/:id')
  @ApiOperation({ summary: 'Sửa summary' })
  updateSummary(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSummaryDto,
  ) {
    return this.adminAiContentService.updateSummary(id, dto);
  }

  @Post('ai-content/summaries/:id/retry')
  @ApiOperation({ summary: 'Retry generate summary nếu lỗi hoặc nội dung kém' })
  retrySummary(@Param('id', ParseIntPipe) id: number) {
    return this.adminAiContentService.retrySummary(id);
  }

  @Delete('ai-content/summaries/:id')
  @ApiOperation({ summary: 'Xóa summary' })
  removeSummary(@Param('id', ParseIntPipe) id: number) {
    return this.adminAiContentService.removeSummary(id);
  }

  @Get('ai-content/true-false')
  @ApiOperation({ summary: 'Danh sách câu đúng/sai AI đã tạo' })
  findTrueFalseQuestions(@Query() query: AdminAiContentQueryDto) {
    return this.adminAiContentService.findTrueFalseQuestions(query);
  }

  @Get('ai-content/true-false/:id')
  @ApiOperation({ summary: 'Chi tiết câu đúng/sai' })
  findTrueFalseQuestion(@Param('id', ParseIntPipe) id: number) {
    return this.adminAiContentService.findTrueFalseQuestion(id);
  }

  @Patch('ai-content/true-false/:id')
  @ApiOperation({ summary: 'Sửa câu đúng/sai, đáp án, giải thích' })
  updateTrueFalseQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTrueFalseDto,
  ) {
    return this.adminAiContentService.updateTrueFalseQuestion(id, dto);
  }

  @Post('ai-content/true-false/documents/:documentId/retry')
  @ApiOperation({
    summary: 'Retry generate toàn bộ câu đúng/sai cho một tài liệu',
  })
  retryTrueFalseByDocument(
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    return this.adminAiContentService.retryTrueFalseByDocument(documentId);
  }

  @Delete('ai-content/true-false/:id')
  @ApiOperation({ summary: 'Xóa câu đúng/sai' })
  removeTrueFalseQuestion(@Param('id', ParseIntPipe) id: number) {
    return this.adminAiContentService.removeTrueFalseQuestion(id);
  }

  @Get('users')
  @ApiOperation({ summary: 'Danh sách user, tìm kiếm theo email/tên/role' })
  findUsers(@Query() query: AdminUserQueryDto) {
    return this.adminUsersService.findAll(query);
  }

  @Get('users/:id')
  @ApiOperation({
    summary: 'Chi tiết user: profile, tài liệu, bài thi đã làm, tiến độ học',
  })
  findUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminUsersService.findOne(id);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Đổi role user/admin' })
  updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() admin: any,
  ) {
    return this.adminUsersService.updateRole(id, dto.role, admin.userId);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Khóa hoặc mở khóa tài khoản' })
  updateUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() admin: any,
  ) {
    return this.adminUsersService.updateStatus(id, dto.isActive, admin.userId);
  }

  @Post('users/:id/revoke-sessions')
  @ApiOperation({ summary: 'Thu hồi refresh token/logout khỏi mọi thiết bị' })
  revokeUserSessions(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminUsersService.revokeSessions(id);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Xóa tài khoản người dùng' })
  removeUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: any,
  ) {
    return this.adminUsersService.remove(id, admin.userId);
  }
}
