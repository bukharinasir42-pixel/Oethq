import { IsNotEmpty } from "class-validator";

export class TasksForUserDto {
  @IsNotEmpty()
  userId!: string;
}
