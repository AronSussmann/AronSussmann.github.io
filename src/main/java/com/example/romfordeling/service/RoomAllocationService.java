package com.example.romfordeling.service;

import com.example.romfordeling.model.ApplicantRequest;
import com.example.romfordeling.model.Assignment;
import com.example.romfordeling.model.AssignmentResponse;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;

public class RoomAllocationService {
    private static final int MAX_PREFERENCES = 8;

    public AssignmentResponse assign(List<ApplicantRequest> applicants, List<String> availableRoomsInput) {
        if (applicants == null || applicants.isEmpty()) {
            return new AssignmentResponse(List.of(), List.of());
        }

        Random random = new Random();
        List<ApplicantState> states = applicants.stream()
                .map(ApplicantState::from)
                .toList();

        Set<String> availableRooms = new LinkedHashSet<>();
        availableRooms.addAll(cleanRoomList(availableRoomsInput));

        Map<String, Assignment> assigned = new LinkedHashMap<>();
        Set<ApplicantState> unassignedStates = new HashSet<>(states);

        for (int rank = 0; rank < MAX_PREFERENCES; rank++) {
            boolean newRoomsAdded;
            do {
                newRoomsAdded = false;
                Map<String, List<ApplicantState>> roomSingles = new HashMap<>();
                Map<String, Map<String, List<ApplicantState>>> roomPairs = new HashMap<>();
                for (ApplicantState state : unassignedStates) {
                    if (state.preferences.size() <= rank) {
                        continue;
                    }
                    Preference preference = state.preferences.get(rank);
                    String room = preference.room();
                    if (!availableRooms.contains(room)) {
                        continue;
                    }
                    if (preference.groupCode().isEmpty()) {
                        roomSingles.computeIfAbsent(room, key -> new ArrayList<>()).add(state);
                    } else {
                        roomPairs
                                .computeIfAbsent(room, key -> new HashMap<>())
                                .computeIfAbsent(preference.groupCode(), key -> new ArrayList<>())
                                .add(state);
                    }
                }

                if (roomSingles.isEmpty() && roomPairs.isEmpty()) {
                    continue;
                }

                Set<String> roomsToProcess = new HashSet<>();
                roomsToProcess.addAll(roomSingles.keySet());
                roomsToProcess.addAll(roomPairs.keySet());

                for (String room : roomsToProcess) {
                    if (!availableRooms.contains(room)) {
                        continue;
                    }
                    List<Candidate> contenders = new ArrayList<>();

                    List<ApplicantState> singles = roomSingles.getOrDefault(room, List.of());
                    for (ApplicantState single : singles) {
                        contenders.add(Candidate.single(single));
                    }

                    Map<String, List<ApplicantState>> pairsForRoom = roomPairs.getOrDefault(room, Map.of());
                    for (List<ApplicantState> groupMembers : pairsForRoom.values()) {
                        if (groupMembers.size() < 2) {
                            continue;
                        }
                        List<ApplicantState> sorted = new ArrayList<>(groupMembers);
                        Collections.shuffle(sorted, random);
                        sorted.sort((left, right) -> {
                            int seniority = Integer.compare(right.seniority, left.seniority);
                            if (seniority != 0) {
                                return seniority;
                            }
                            int roomPriority = Integer.compare(right.currentRoomPriority, left.currentRoomPriority);
                            if (roomPriority != 0) {
                                return roomPriority;
                            }
                            return 0;
                        });
                        ApplicantState first = sorted.get(0);
                        ApplicantState second = sorted.get(1);
                        contenders.add(Candidate.pair(first, second));
                    }

                    if (contenders.isEmpty()) {
                        continue;
                    }

                    Collections.shuffle(contenders, random);
                    contenders.sort((left, right) -> {
                        int seniority = Integer.compare(right.seniorityScore, left.seniorityScore);
                        if (seniority != 0) {
                            return seniority;
                        }
                        int roomPriority = Integer.compare(right.roomPriorityScore, left.roomPriorityScore);
                        if (roomPriority != 0) {
                            return roomPriority;
                        }
                        return 0;
                    });

                    Candidate winner = contenders.getFirst();
                    for (ApplicantState state : winner.members) {
                        assigned.put(state.name, new Assignment(state.name, room, winner.note));
                        unassignedStates.remove(state);
                    }
                    availableRooms.remove(room);

                    for (ApplicantState member : winner.members) {
                        if (!member.currentRoom.isEmpty() && !member.currentRoom.equals(room)) {
                            if (availableRooms.add(member.currentRoom)) {
                                newRoomsAdded = true;
                            }
                        }
                    }
                }
            } while (newRoomsAdded);
        }

        List<Assignment> assignedList = new ArrayList<>(assigned.values());
        List<Assignment> unassigned = unassignedStates.stream()
                .map(state -> new Assignment(state.name, null, "Ingen ledige rom i \u00f8nsker"))
                .toList();

        return new AssignmentResponse(assignedList, unassigned);
    }

    private static class ApplicantState {
        private final String name;
        private final int seniority;
        private final int currentRoomPriority;
        private final String currentRoom;
        private final List<Preference> preferences;

        private ApplicantState(String name, int seniority, int currentRoomPriority, String currentRoom, List<Preference> preferences) {
            this.name = name;
            this.seniority = seniority;
            this.currentRoomPriority = currentRoomPriority;
            this.currentRoom = currentRoom;
            this.preferences = preferences;
        }

        private static ApplicantState from(ApplicantRequest applicant) {
            String name = cleanString(applicant.name());
            int seniority = Math.max(0, applicant.seniority());
            int roomPriority = roomTypePriority(applicant.currentRoomType());
            String currentRoom = cleanString(applicant.currentRoom());
            List<Preference> preferences = normalizePreferences(applicant.preferences());
            return new ApplicantState(name, seniority, roomPriority, currentRoom, preferences);
        }

        private static List<Preference> normalizePreferences(List<String> preferences) {
            if (preferences == null) {
                return List.of();
            }
            return preferences.stream()
                    .map(ApplicantState::cleanString)
                    .filter(value -> !value.isEmpty())
                    .limit(MAX_PREFERENCES)
                    .map(Preference::fromRaw)
                    .collect(Collectors.toList());
        }

        private static String cleanString(String value) {
            if (value == null) {
                return "";
            }
            return value.trim();
        }

        private static int roomTypePriority(String roomType) {
            if (roomType == null) {
                return 0;
            }
            String normalized = roomType.trim().toLowerCase(Locale.ROOT);
            return switch (normalized) {
                case "fleksirom" -> 4;
                case "parrom" -> 3;
                case "enkeltrom" -> 2;
                case "porten" -> 1;
                default -> 0;
            };
        }

    }

    private record Preference(String room, String groupCode) {
        private static Preference fromRaw(String raw) {
            String[] parts = raw.trim().split("\\s+");
            String room = parts.length > 0 ? parts[0] : "";
            String code = parts.length > 1 ? parts[1] : "";
            return new Preference(room, code);
        }
    }

    private static class Candidate {
        private final List<ApplicantState> members;
        private final int seniorityScore;
        private final int roomPriorityScore;
        private final String note;

        private Candidate(List<ApplicantState> members, int seniorityScore, int roomPriorityScore, String note) {
            this.members = members;
            this.seniorityScore = seniorityScore;
            this.roomPriorityScore = roomPriorityScore;
            this.note = note;
        }

        private static Candidate single(ApplicantState applicant) {
            return new Candidate(List.of(applicant), applicant.seniority, applicant.currentRoomPriority, "Tildelt fra \u00f8nskeliste");
        }

        private static Candidate pair(ApplicantState first, ApplicantState second) {
            int seniorityScore = first.seniority + second.seniority;
            int roomPriorityScore = first.currentRoomPriority + second.currentRoomPriority;
            return new Candidate(List.of(first, second), seniorityScore, roomPriorityScore, "Tildelt fra \u00f8nskeliste (par)");
        }
    }

    private static List<String> cleanRoomList(List<String> rooms) {
        if (rooms == null) {
            return List.of();
        }
        return rooms.stream()
                .map(ApplicantState::cleanString)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toList());
    }
}


