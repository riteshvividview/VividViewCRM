import { Module } from '@nestjs/common';
import { ActivityModule } from './activity/activity.module';
import { ProjectModule } from './project/project.module';
import { BoardModule } from './board/board.module';
import { SprintModule } from './sprint/sprint.module';
import { TaskModule } from './task/task.module';
import { LabelModule } from './label/label.module';
import { CommentModule } from './comment/comment.module';
import { TimeTrackingModule } from './time-tracking/time-tracking.module';

@Module({
  imports: [
    ActivityModule,
    ProjectModule,
    BoardModule,
    SprintModule,
    TaskModule,
    LabelModule,
    CommentModule,
    TimeTrackingModule,
  ],
})
export class TasksModule {}
