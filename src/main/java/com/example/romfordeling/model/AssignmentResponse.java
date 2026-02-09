package com.example.romfordeling.model;

import java.util.List;

public record AssignmentResponse(List<Assignment> assignments, List<Assignment> unassigned) {
}
