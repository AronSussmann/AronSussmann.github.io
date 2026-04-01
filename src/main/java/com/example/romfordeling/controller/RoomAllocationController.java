package com.example.romfordeling.controller;

import com.example.romfordeling.model.AllocationRequest;
import com.example.romfordeling.model.ApplicantRequest;
import com.example.romfordeling.model.AssignmentResponse;
import com.example.romfordeling.service.RoomAllocationService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class RoomAllocationController {
    private final RoomAllocationService allocationService;

    public RoomAllocationController(RoomAllocationService allocationService) {
        this.allocationService = allocationService;
    }

    @PostMapping(path = "/assign", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public AssignmentResponse assign(@RequestBody(required = false) AllocationRequest request) {
        if (request == null) {
            return new AssignmentResponse(List.of(), List.of());
        }
        List<ApplicantRequest> applicants = request.applicants() == null ? List.of() : request.applicants();
        List<String> availableRooms = request.availableRooms() == null ? List.of() : request.availableRooms();
        return allocationService.assign(applicants, availableRooms);
    }
}
