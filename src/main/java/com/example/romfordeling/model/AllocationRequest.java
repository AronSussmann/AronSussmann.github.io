package com.example.romfordeling.model;

import java.util.List;

public record AllocationRequest(List<ApplicantRequest> applicants, List<String> availableRooms) {
}
