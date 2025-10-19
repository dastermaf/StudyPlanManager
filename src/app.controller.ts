import { Controller, Get, Render } from '@nestjs/common';

@Controller()
export class AppController {

  @Get()
  @Render('index') // public/layout/index.hbs
  root() {

    return { 
      pageTitle: 'StudyPlanManager', 
      message: 'Hello World!' 
    };
  }
}