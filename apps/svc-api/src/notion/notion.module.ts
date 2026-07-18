import { Module } from "@nestjs/common"

import { NotionService } from "./notion.service"
import { NotionResolver } from "./notion.resolver"
import { NotionController } from "./notion.controller"

@Module({
  controllers: [NotionController],
  providers: [NotionService, NotionResolver],
  exports: [NotionService],
})
export class NotionModule {}
