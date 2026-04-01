package com.example.romfordeling.service;

import com.example.romfordeling.model.ApplicantRequest;
import com.example.romfordeling.model.Assignment;
import com.example.romfordeling.model.AssignmentResponse;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RoomAllocationServiceTest {

    private final RoomAllocationService service = new RoomAllocationService();

    @Test
    void assignReturnsEmptyWhenNoApplicants() {
        AssignmentResponse response = service.assign(List.of(), List.of("101"));

        assertTrue(response.assignments().isEmpty());
        assertTrue(response.unassigned().isEmpty());
    }

    @Test
    void assignAllocatesPairTogetherWhenGroupCodeMatches() {
        List<ApplicantRequest> applicants = List.of(
                applicant("Anna", "901", "Enkeltrom", 4, List.of("116 TEAM")),
                applicant("Bjarne", "902", "Parrom", 3, List.of("116 TEAM"))
        );

        AssignmentResponse response = service.assign(applicants, List.of("116"));

        assertEquals(2, response.assignments().size());
        assertTrue(response.unassigned().isEmpty());
        assertTrue(response.assignments().stream().allMatch(item -> "116".equals(item.assignedRoom())));
        assertTrue(response.assignments().stream().allMatch(item -> "Tildelt fra ønskeliste (par)".equals(item.note())));
    }

    @Test
    void assignFallsBackToSingleWhenPairMatchIsMissing() {
        List<ApplicantRequest> applicants = List.of(
                applicant("Anna", "901", "Enkeltrom", 5, List.of("116 TEAM1")),
                applicant("Bjarne", "902", "Enkeltrom", 1, List.of("116 TEAM2"))
        );

        AssignmentResponse response = service.assign(applicants, List.of("116"));

        assertEquals(1, response.assignments().size());
        assertEquals(1, response.unassigned().size());
        assertEquals("Anna", response.assignments().getFirst().name());
        assertEquals("116", response.assignments().getFirst().assignedRoom());
        assertEquals("Tildelt fra ønskeliste (parønske uten match)", response.assignments().getFirst().note());
    }

    @Test
    void assignReusesFreedRoomsWithinSamePreferenceRank() {
        List<ApplicantRequest> applicants = List.of(
                applicant("Anna", "201", "Parrom", 10, List.of("101")),
                applicant("Bjarne", "301", "Enkeltrom", 1, List.of("201"))
        );

        AssignmentResponse response = service.assign(applicants, List.of("101"));

        assertEquals(2, response.assignments().size());
        assertTrue(response.unassigned().isEmpty());
        assertEquals("101", response.assignments().get(0).assignedRoom());
        assertEquals("201", response.assignments().get(1).assignedRoom());
    }

    @Test
    void assignDoesNotCollapseApplicantsWithSameName() {
        List<ApplicantRequest> applicants = List.of(
                applicant("Alex", "901", "Enkeltrom", 2, List.of("R1")),
                applicant("Alex", "902", "Enkeltrom", 1, List.of("R2"))
        );

        AssignmentResponse response = service.assign(applicants, List.of("R1", "R2"));

        assertEquals(2, response.assignments().size());
        assertTrue(response.unassigned().isEmpty());
        List<String> names = response.assignments().stream().map(Assignment::name).toList();
        assertIterableEquals(List.of("Alex", "Alex"), names);
        Set<String> rooms = response.assignments().stream().map(Assignment::assignedRoom).collect(Collectors.toSet());
        assertEquals(Set.of("R1", "R2"), rooms);
    }

    @Test
    void assignNormalizesAndDeduplicatesRoomList() {
        List<ApplicantRequest> applicants = List.of(
                applicant("Anna", "901", "Enkeltrom", 3, List.of("a12"))
        );

        AssignmentResponse response = service.assign(applicants, List.of(" A12 ", "a12"));

        assertEquals(1, response.assignments().size());
        assertEquals("A12", response.assignments().getFirst().assignedRoom());
    }

    @Test
    void assignMatchesPairCodesCaseInsensitive() {
        List<ApplicantRequest> applicants = List.of(
                applicant("Anna", "901", "Enkeltrom", 4, List.of("116 teamx")),
                applicant("Bjarne", "902", "Parrom", 4, List.of("116 TEAMX"))
        );

        AssignmentResponse response = service.assign(applicants, List.of("116"));

        assertEquals(2, response.assignments().size());
        assertTrue(response.unassigned().isEmpty());
        assertTrue(response.assignments().stream().allMatch(item -> "Tildelt fra ønskeliste (par)".equals(item.note())));
    }

    @Test
    void assignLimitsPreferencesToEightEntries() {
        List<ApplicantRequest> applicants = List.of(
                applicant("Anna", "901", "Enkeltrom", 4, List.of("R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9"))
        );

        AssignmentResponse response = service.assign(applicants, List.of("R9"));

        assertTrue(response.assignments().isEmpty());
        assertEquals(1, response.unassigned().size());
        assertEquals("Anna", response.unassigned().getFirst().name());
    }

    @Test
    void assignSkipsNullApplicantEntries() {
        List<ApplicantRequest> applicants = Arrays.asList(
                null,
                applicant("Aron", "901", "Enkeltrom", 4, List.of("101"))
        );

        AssignmentResponse response = service.assign(applicants, List.of("101"));

        assertEquals(1, response.assignments().size());
        assertTrue(response.unassigned().isEmpty());
        assertEquals("Aron", response.assignments().getFirst().name());
    }

    @Test
    void assignHandlesNullAndBlankAvailableRooms() {
        List<ApplicantRequest> applicants = List.of(
                applicant("Aron", "901", "Enkeltrom", 4, List.of("101"))
        );

        AssignmentResponse response = service.assign(applicants, Arrays.asList(null, "", "   ", "101"));

        assertEquals(1, response.assignments().size());
        assertEquals("101", response.assignments().getFirst().assignedRoom());
    }

    @Test
    void assignMarksEveryoneUnassignedWhenNoRoomsAreAvailable() {
        List<ApplicantRequest> applicants = List.of(
                applicant("Aron", "901", "Enkeltrom", 4, List.of("101")),
                applicant("Emma", "902", "Parrom", 3, List.of("202"))
        );

        AssignmentResponse response = service.assign(applicants, List.of());

        assertTrue(response.assignments().isEmpty());
        assertEquals(2, response.unassigned().size());
        assertEquals(Set.of("Aron", "Emma"), response.unassigned().stream().map(Assignment::name).collect(Collectors.toSet()));
    }

    private static ApplicantRequest applicant(String name, String currentRoom, String roomType, int seniority, List<String> preferences) {
        return new ApplicantRequest(name, currentRoom, roomType, seniority, preferences);
    }
}
