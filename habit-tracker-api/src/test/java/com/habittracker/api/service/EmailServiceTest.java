package com.habittracker.api.service;

import com.icegreen.greenmail.configuration.GreenMailConfiguration;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.util.ServerSetup;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class EmailServiceTest {

    @RegisterExtension
    static GreenMailExtension greenMail = new GreenMailExtension(
            new ServerSetup(3025, null, "smtp")
    ).withConfiguration(GreenMailConfiguration.aConfig().withUser("test", "test"));

    @Autowired
    private EmailService emailService;

    @Test
    void sendHabitReminder_shouldSendEmail() throws MessagingException {
        String to = "user@example.com";
        emailService.sendHabitReminder(to, "Morning Run", "Go jogging");

        MimeMessage[] messages = greenMail.getReceivedMessages();
        assertThat(messages).hasSize(1);
        assertThat(messages[0].getSubject()).contains("Morning Run");
        assertThat(messages[0].getAllRecipients()[0].toString()).isEqualTo(to);
    }

    @Test
    void sendPasswordResetEmail_shouldSendEmail() throws MessagingException {
        String to = "user@example.com";
        String token = "reset-token-123";

        emailService.sendPasswordResetEmail(to, token);

        MimeMessage[] messages = greenMail.getReceivedMessages();
        assertThat(messages).hasSize(1);
        assertThat(messages[0].getSubject()).contains("Сброс пароля");
    }

    @Test
    void sendVerificationCode_shouldSendEmail() throws MessagingException {
        String to = "user@example.com";
        String code = "123456";

        emailService.sendVerificationCode(to, code);

        MimeMessage[] messages = greenMail.getReceivedMessages();
        assertThat(messages).hasSize(1);
        assertThat(messages[0].getSubject()).contains("Код подтверждения");
    }
}
