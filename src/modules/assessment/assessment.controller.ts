import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AssessmentService } from './services/assessment.service';
import { RecommendationService } from './services/recommendation.service';
import {
  SubmitExamAttemptDto,
  ExamResultDto,
  RecommendationDto,
  ActivitySuggestionDto,
  UserProgressDto,
} from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/interfaces/jwt-user.interface';

@ApiTags('Assessment')
@ApiBearerAuth('JWT')
@Controller('assessment')
export class AssessmentController {
  constructor(
    private readonly assessmentService: AssessmentService,
    private readonly recommendationService: RecommendationService,
  ) {}

  @Post('exams/:examId/submit')
  @ApiOperation({
    summary: 'Submit exam attempt',
    description:
      'Submit answers for an exam with confidence levels and get personalized feedback',
  })
  @ApiResponse({
    status: 201,
    description: 'Exam submitted successfully',
    type: ExamResultDto,
  })
  @ApiResponse({ status: 404, description: 'Exam not found' })
  async submitExam(
    @CurrentUser() user: JwtUser,
    @Param('examId', ParseIntPipe) examId: number,
    @Body() dto: SubmitExamAttemptDto,
  ): Promise<ExamResultDto> {
    return await this.assessmentService.submitExamAttempt(
      user.userId,
      examId,
      dto,
    );
  }

  @Get('recommendations')
  @ApiOperation({
    summary: 'Get personalized recommendations',
    description: 'Get AI-powered recommendations for next activities',
  })
  @ApiResponse({
    status: 200,
    description: 'Recommendations retrieved successfully',
    type: [RecommendationDto],
  })
  async getRecommendations(
    @CurrentUser() user: JwtUser,
  ): Promise<RecommendationDto[]> {
    return await this.recommendationService.getRecommendations(user.userId);
  }

  @Get('next-activity')
  @ApiOperation({
    summary: 'Get next suggested activity',
    description: 'Get the highest priority recommended activity',
  })
  @ApiResponse({
    status: 200,
    description: 'Next activity retrieved successfully',
    type: ActivitySuggestionDto,
  })
  async getNextActivity(
    @CurrentUser() user: JwtUser,
  ): Promise<ActivitySuggestionDto | null> {
    return await this.recommendationService.getNextActivity(user.userId);
  }

  @Get('progress')
  @ApiOperation({
    summary: 'Get user progress',
    description: 'Get general progress information and motivational message',
  })
  @ApiResponse({
    status: 200,
    description: 'Progress retrieved successfully',
    type: UserProgressDto,
  })
  async getProgress(@CurrentUser() user: JwtUser): Promise<UserProgressDto> {
    return await this.assessmentService.getUserProgress(user.userId);
  }
}
