# ---- build stage ----
FROM gradle:8.14-jdk21 AS build
WORKDIR /app
COPY . .
RUN gradle build -x test

# ---- run stage ----
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY . .
RUN chmod +x ./gradlew && ./gradlew build -x test

