import { Controller, Get, Render, Param, Query, Res, Redirect } from '@nestjs/common'; 
import { Response } from 'express';

@Controller()
export class AppController {

    // REDIRECT:
    @Get()
  @Redirect('/login', 302) // Перенаправляем на /login со статусом 302 (временный редирект)
  redirectToLogin() {
  }

  // LOGIN PAGE:
  @Get('login')
  @Render('login') // public/layout/login.hbs
  showLoginPage() {
    return {
      pageTitle: 'ログイン - SPManager',
    };
  }

  // MAIN PAGE:
  @Get('app') 
  @Render('index') // public/layout/index.hbs 
  showAppPage() {
    // В будущем здесь можно передавать данные пользователя
    return {
      pageTitle: 'Plan Manager',
      username: 'ユーザー', // будет связано с бд в будущем
      projectTitle: 'Stady Plan Manager'
    };
  }

  // MATERIALS PAGE: ('/materials/:subjectId/:chapterNo') 
  @Get('materials/:subjectId/:chapterNo')
  @Render('materials') // public/layout/materials.hbs
  showMaterialsPage(@Param('subjectId') subjectId: string, @Param('chapterNo') chapterNo: string) {
    // Здесь можно будет получать название предмета из `subjectId`
    const subjectName = `科目： ${subjectId}`; // Заглушка
    return {
      pageTitle: `${subjectName} - Глава ${chapterNo}`,
      subjectId: subjectId, // Передаем параметры в шаблон, если они там нужны
      chapterNo: chapterNo
    };
  }

  // DASHBOARD PAGE ('/dashboard') 
  @Get('dashboard')
  @Render('dashboard') // public/layout/dashboard.hbs
  showDashboardPage() {
    return {
      pageTitle: 'Dashboard - SPManager'
    };
  }

  // ABOUT PAGE ('/about') 
  @Get('about')
  @Render('about') // public/layout/about.hbs
  showAboutPage() {
    return {
      pageTitle: 'About - SPManager'
    };
  }

  // ERROR PAGE('/error') 
  @Get('error')
  @Render('error') // public/layout/error.hbs
  showErrorPage(@Query('code') code?: string, @Query('msg') msg?: string) {
    // Передаем код и сообщение ошибки в шаблон
    return {
      pageTitle: 'エラー | SPManager',
      errorCode: code || 'UNKNOWN',
      errorMessage: msg || 'エラーが発生しました。'
    };
  }

  //  FAVICON ROOTING
  @Get('favicon.ico')
  redirectToFavicon(@Res() res: Response) {
    // Делаем редирект на реальный файл иконки
    res.redirect(301, 'public/image/favicon.png');
  }
}