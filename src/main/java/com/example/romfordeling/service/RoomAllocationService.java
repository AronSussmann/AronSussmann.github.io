package com.example.romfordeling.service;

import com.example.romfordeling.model.ApplicantRequest;
import com.example.romfordeling.model.Assignment;
import com.example.romfordeling.model.AssignmentResponse;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.Set;

@Service
public class RoomAllocationService {
    private static final int MAX_PREFERENCES = 8;
    private static final String NOTE_FROM_PREFERENCES = "Tildelt fra ønskeliste";
    private static final String NOTE_FROM_PAIR = "Tildelt fra ønskeliste (par)";
    private static final String NOTE_FROM_PAIR_FALLBACK = "Tildelt fra ønskeliste (parønske uten match)";
    private static final String NOTE_UNASSIGNED = "Ingen ledige rom i ønsker";

    public AssignmentResponse assign(List<ApplicantRequest> applicants, List<String> availableRoomsInput) {
        if (applicants == null || applicants.isEmpty()) {
            return new AssignmentResponse(List.of(), List.of());
        }

        List<ApplicantState> states = new ArrayList<>();
        for (int index = 0; index < applicants.size(); index++) {
            ApplicantState state = ApplicantState.from(applicants.get(index), index);
            if (state != null) {
                states.add(state);
            }
        }
        if (states.isEmpty()) {
            return new AssignmentResponse(List.of(), List.of());
        }
        Random random = new Random();

        Set<String> availableRooms = new LinkedHashSet<>(cleanRoomList(availableRoomsInput));
        Map<ApplicantState, Assignment> assigned = new LinkedHashMap<>();
        Set<ApplicantState> unassignedStates = new LinkedHashSet<>(states);

        for (int rank = 0; rank < MAX_PREFERENCES; rank++) {
            boolean newRoomsAdded;
            do {
                newRoomsAdded = false;
                Map<String, List<ApplicantState>> roomSingles = new HashMap<>();
                Map<String, Map<String, List<ApplicantState>>> roomPairs = new HashMap<>();

                for (ApplicantState state : unassignedStates) {
                    Preference preference = state.preferenceAt(rank);
                    if (preference == null || !availableRooms.contains(preference.room())) {
                        continue;
                    }
                    if (preference.groupCode().isEmpty()) {
                        roomSingles.computeIfAbsent(preference.room(), key -> new ArrayList<>()).add(state);
                    } else {
                        roomPairs
                                .computeIfAbsent(preference.room(), key -> new HashMap<>())
                                .computeIfAbsent(preference.groupCode(), key -> new ArrayList<>())
                                .add(state);
                    }
                }

                if (roomSingles.isEmpty() && roomPairs.isEmpty()) {
                    continue;
                }

                List<String> roomsToProcess = new ArrayList<>(availableRooms);
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
                        List<ApplicantState> sortedMembers = new ArrayList<>(groupMembers);
                        sortedMembers.sort(Comparator.comparingInt(ApplicantState::inputOrder));
                        if (sortedMembers.size() == 2) {
                            contenders.add(Candidate.pair(sortedMembers.get(0), sortedMembers.get(1)));
                            continue;
                        }
                        for (ApplicantState member : sortedMembers) {
                            contenders.add(Candidate.singleFromInvalidPair(member));
                        }
                    }

                    Candidate winner = chooseWinner(contenders, random);
                    if (winner == null) {
                        continue;
                    }

                    availableRooms.remove(room);
                    for (ApplicantState member : winner.members()) {
                        assigned.put(member, new Assignment(member.name, room, winner.note()));
                        unassignedStates.remove(member);

                        if (!member.currentRoom.isEmpty() && !member.currentRoom.equals(room)) {
                            if (availableRooms.add(member.currentRoom)) {
                                newRoomsAdded = true;
                            }
                        }
                    }
                }
            } while (newRoomsAdded);
        }

        List<Assignment> assignedList = states.stream()
                .map(assigned::get)
                .filter(Objects::nonNull)
                .toList();
        List<Assignment> unassigned = states.stream()
                .filter(state -> !assigned.containsKey(state))
                .map(state -> new Assignment(state.name, null, NOTE_UNASSIGNED))
                .toList();

        return new AssignmentResponse(assignedList, unassigned);
    }

    private static Candidate chooseWinner(List<Candidate> contenders, Random random) {
        if (contenders.isEmpty()) {
            return null;
        }
        // Stable sort + pre-shuffle = lottery among exact ties for each run.
        Collections.shuffle(contenders, random);
        contenders.sort(Candidate.COMPARATOR);
        return contenders.getFirst();
    }

    private record ApplicantState(String name, int seniority, int currentRoomPriority, String currentRoom,
                                  List<Preference> preferences, int inputOrder) {

        private Preference preferenceAt(int rank) {
                if (rank < 0 || rank >= preferences.size()) {
                    return null;
                }
                return preferences.get(rank);
            }

            private static ApplicantState from(ApplicantRequest applicant, int inputOrder) {
                if (applicant == null) {
                    return null;
                }
                String name = cleanString(applicant.name());
                int seniority = Math.max(0, applicant.seniority());
                int roomPriority = roomTypePriority(applicant.currentRoomType());
                String currentRoom = normalizeRoom(applicant.currentRoom());
                List<Preference> preferences = normalizePreferences(applicant.preferences());
                return new ApplicantState(name, seniority, roomPriority, currentRoom, preferences, inputOrder);
            }

            private static List<Preference> normalizePreferences(List<String> preferences) {
                if (preferences == null) {
                    return List.of();
                }
                Set<Preference> unique = new LinkedHashSet<>();
                for (String rawPreference : preferences) {
                    String cleanedRaw = cleanString(rawPreference);
                    if (cleanedRaw.isEmpty()) {
                        continue;
                    }
                    Preference preference = Preference.fromRaw(cleanedRaw);
                    if (preference.room().isEmpty()) {
                        continue;
                    }
                    unique.add(preference);
                    if (unique.size() >= MAX_PREFERENCES) {
                        break;
                    }
                }
                return List.copyOf(unique);
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
            String room = parts.length > 0 ? normalizeRoom(parts[0]) : "";
            String code = parts.length > 1 ? parts[1].trim().toUpperCase(Locale.ROOT) : "";
            return new Preference(room, code);
        }
    }

    private record Candidate(List<ApplicantState> members, int seniorityScore, String note) {
        private static final Comparator<Candidate> COMPARATOR = (left, right) -> Integer.compare(right.seniorityScore, left.seniorityScore);

        private static Candidate single(ApplicantState applicant) {
            return new Candidate(
                    List.of(applicant),
                    applicant.seniority,
                    NOTE_FROM_PREFERENCES
            );
        }

        private static Candidate singleFromInvalidPair(ApplicantState applicant) {
            return new Candidate(
                    List.of(applicant),
                    applicant.seniority,
                    NOTE_FROM_PAIR_FALLBACK
            );
        }

        private static Candidate pair(ApplicantState first, ApplicantState second) {
            return new Candidate(
                    List.of(first, second),
                    first.seniority + second.seniority,
                    NOTE_FROM_PAIR
            );
        }
    }

    private static List<String> cleanRoomList(List<String> rooms) {
        if (rooms == null) {
            return List.of();
        }
        Set<String> uniqueRooms = new LinkedHashSet<>();
        for (String room : rooms) {
            String normalized = normalizeRoom(room);
            if (!normalized.isEmpty()) {
                uniqueRooms.add(normalized);
            }
        }
        return new ArrayList<>(uniqueRooms);
    }

    private static String normalizeRoom(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().toUpperCase(Locale.ROOT);
    }
}
