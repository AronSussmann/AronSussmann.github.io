package com.example.romfordeling.controller;

import com.example.romfordeling.model.AllocationRequest;
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
    private final RoomAllocationService allocationService = new RoomAllocationService();

    @PostMapping(path = "/assign", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public AssignmentResponse assign(@RequestBody AllocationRequest request) {
        if (request == null) {
            return new AssignmentResponse(List.of(), List.of());
        }
        return allocationService.assign(request.applicants(), request.availableRooms());
    }
}
