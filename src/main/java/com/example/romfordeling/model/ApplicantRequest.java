package com.example.romfordeling.model;

import java.util.List;

public record ApplicantRequest(String name, String currentRoom, String currentRoomType, int seniority, List<String> preferences) {
}
