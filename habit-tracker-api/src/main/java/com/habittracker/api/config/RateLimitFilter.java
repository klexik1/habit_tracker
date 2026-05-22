package com.habittracker.api.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RateLimitFilter implements Filter {

    private static final int MAX_REQUESTS = 10;
    private static final long WINDOW_MILLIS = 60_000; // 1 минута

    private final Map<String, RequestBucket> buckets = new ConcurrentHashMap<>();

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpReq = (HttpServletRequest) request;
        HttpServletResponse httpResp = (HttpServletResponse) response;

        String path = httpReq.getRequestURI();
        // Rate limit только для публичных auth-эндпоинтов
        if (!path.startsWith("/api/auth/")) {
            chain.doFilter(request, response);
            return;
        }

        String clientIp = getClientIp(httpReq);
        RequestBucket bucket = buckets.computeIfAbsent(clientIp, k -> new RequestBucket());

        synchronized (bucket) {
            long now = Instant.now().toEpochMilli();
            if (now - bucket.windowStart > WINDOW_MILLIS) {
                bucket.windowStart = now;
                bucket.count = 0;
            }
            bucket.count++;
            if (bucket.count > MAX_REQUESTS) {
                httpResp.setStatus(429);
                httpResp.setContentType("application/json;charset=UTF-8");
                httpResp.getWriter().write("{\"error\":\"Слишком много запросов. Попробуйте позже.\"}");
                return;
            }
        }

        chain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader != null && !xfHeader.isBlank()) {
            return xfHeader.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static class RequestBucket {
        long windowStart = Instant.now().toEpochMilli();
        int count = 0;
    }
}
