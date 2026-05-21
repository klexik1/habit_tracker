package com.habittracker.api.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;
    private final String fromEmail;

    public EmailService(JavaMailSender mailSender, @Value("${spring.mail.username}") String fromEmail) {
        this.mailSender = mailSender;
        this.fromEmail = fromEmail;
    }

    @Async
    public void sendHabitReminder(String to, String habitName, String habitDescription) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject("⏰ Напоминание о привычке: " + habitName);

            String htmlContent = buildEmailHtml(habitName, habitDescription);
            helper.setText(htmlContent, true);

            mailSender.send(message);
            log.info("✅ Email отправлен на {}: привычка '{}'", to, habitName);
        } catch (MessagingException e) {
            log.error("❌ Ошибка создания email для {}: {}", to, e.getMessage(), e);
        } catch (Exception e) {
            log.error("❌ Неожиданная ошибка при отправке email на {}: {}", to, e.getMessage(), e);
        }
    }

    @Async
    public void sendVerificationCode(String to, String code) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject("🔐 Код подтверждения email");

            String htmlContent = buildVerificationCodeHtml(code);
            helper.setText(htmlContent, true);

            mailSender.send(message);
            log.info("✅ Код верификации отправлен на {}", to);
        } catch (MessagingException e) {
            log.error("❌ Ошибка отправки кода верификации на {}: {}", to, e.getMessage(), e);
        } catch (Exception e) {
            log.error("❌ Неожиданная ошибка при отправке кода на {}: {}", to, e.getMessage(), e);
        }
    }

    @Async
    public void sendHourBeforeReminder(String to, String habitName, String habitDescription) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject("⏳ Через час: " + habitName);

            String htmlContent = buildHourBeforeEmailHtml(habitName, habitDescription);
            helper.setText(htmlContent, true);

            mailSender.send(message);
            log.info("✅ Hour-before email отправлен на {}: привычка '{}'", to, habitName);
        } catch (MessagingException e) {
            log.error("❌ Ошибка создания hour-before email для {}: {}", to, e.getMessage(), e);
        } catch (Exception e) {
            log.error("❌ Неожиданная ошибка при отправке hour-before email на {}: {}", to, e.getMessage(), e);
        }
    }

    private String buildEmailHtml(String habitName, String habitDescription) {
        String template = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .header h1 { margin: 0; font-size: 24px; }
                    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                    .habit-name { font-size: 20px; color: #667eea; margin-bottom: 10px; }
                    .habit-description { color: #666; margin-bottom: 20px; }
                    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; }
                    .footer { text-align: center; margin-top: 20px; color: #999; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>⏰ Напоминание о привычке</h1>
                    </div>
                    <div class="content">
                        <p class="habit-name"><strong>{{HABIT_NAME}}</strong></p>
                        <p class="habit-description">{{HABIT_DESC}}</p>
                        <p>Не забудьте отметить выполнение этой привычки сегодня!</p>
                        <p style="text-align: center; margin-top: 25px;">
                            <a href="http://localhost:8080" class="button">Отметить выполнение</a>
                        </p>
                        <div class="footer">
                            <p>Это письмо отправлено автоматически. Пожалуйста, не отвечайте на него.</p>
                            <p>© 2026 Habit Tracker</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            """;
        return template
            .replace("{{HABIT_NAME}}", escapeHtml(habitName))
            .replace("{{HABIT_DESC}}", escapeHtml(habitDescription != null ? habitDescription : "Без описания"));
    }

    private String buildHourBeforeEmailHtml(String habitName, String habitDescription) {
        String template = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #f39c12 0%%, #e74c3c 100%%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .header h1 { margin: 0; font-size: 24px; }
                    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                    .habit-name { font-size: 20px; color: #e74c3c; margin-bottom: 10px; }
                    .habit-description { color: #666; margin-bottom: 20px; }
                    .button { display: inline-block; background: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; }
                    .footer { text-align: center; margin-top: 20px; color: #999; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>⏳ Скоро время привычки</h1>
                    </div>
                    <div class="content">
                        <p class="habit-name"><strong>{{HABIT_NAME}}</strong></p>
                        <p class="habit-description">{{HABIT_DESC}}</p>
                        <p>Остался всего час! Не забудьте подготовиться.</p>
                        <p style="text-align: center; margin-top: 25px;">
                            <a href="http://localhost:8080" class="button">Отметить выполнение</a>
                        </p>
                        <div class="footer">
                            <p>Это письмо отправлено автоматически. Пожалуйста, не отвечайте на него.</p>
                            <p>© 2026 Habit Tracker</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            """;
        return template
            .replace("{{HABIT_NAME}}", escapeHtml(habitName))
            .replace("{{HABIT_DESC}}", escapeHtml(habitDescription != null ? habitDescription : "Без описания"));
    }

    private String buildVerificationCodeHtml(String code) {
        String template = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .header h1 { margin: 0; font-size: 24px; }
                    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; text-align: center; }
                    .code { font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; margin: 20px 0; padding: 15px; background: #fff; border-radius: 8px; border: 2px dashed #667eea; display: inline-block; }
                    .footer { text-align: center; margin-top: 20px; color: #999; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Подтверждение email</h1>
                    </div>
                    <div class="content">
                        <p>Введите этот код в приложении Habit Tracker для подтверждения вашего email:</p>
                        <div class="code">{{CODE}}</div>
                        <p style="color: #888; font-size: 14px;">Код действителен в течение 15 минут.<br>Если вы не запрашивали подтверждение — проигнорируйте это письмо.</p>
                    </div>
                    <div class="footer">
                        <p>© 2026 Habit Tracker</p>
                    </div>
                </div>
            </body>
            </html>
            """;
        return template.replace("{{CODE}}", escapeHtml(code));
    }

    private String escapeHtml(String text) {
        return text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;");
    }
}
