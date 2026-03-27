import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AssessmentService } from './services/assessment.service';
import { RecommendationService } from './services/recommendation.service';
import {
  SubmitExamAttemptDto,
  ExamResultDto,
  RecommendationDto,
  ActivitySuggestionDto,
  UserProgressDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Assessment')
@Controller('assessment')
@UseGuards(JwtAuthGuard)
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
  async submitExam(
    @CurrentUser() user: User,
    @Param('examId', ParseIntPipe) examId: number,
    @Body() dto: SubmitExamAttemptDto,
  ): Promise<ExamResultDto> {
    return await this.assessmentService.submitExamAttempt(
      user.id,
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
    @CurrentUser() user: User,
  ): Promise<RecommendationDto[]> {
    return await this.recommendationService.getRecommendations(user.id);
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
    @CurrentUser() user: User,
  ): Promise<ActivitySuggestionDto | null> {
    return await this.recommendationService.getNextActivity(user.id);
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
  async getProgress(@CurrentUser() user: User): Promise<UserProgressDto> {
    return await this.assessmentService.getUserProgress(user.id);
  }
}
