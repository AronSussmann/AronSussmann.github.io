package com.example.romfordeling.controller;

import com.example.romfordeling.model.AllocationRequest;
import com.example.romfordeling.model.ApplicantRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class RoomAllocationControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void assignEndpointReturnsExpectedAssignmentPayload() throws Exception {
        AllocationRequest request = new AllocationRequest(
                List.of(new ApplicantRequest("Aron", "900", "Enkeltrom", 4, List.of("101"))),
                List.of("101")
        );

        mockMvc.perform(post("/api/assign")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignments.length()").value(1))
                .andExpect(jsonPath("$.unassigned.length()").value(0))
                .andExpect(jsonPath("$.assignments[0].name").value("Aron"))
                .andExpect(jsonPath("$.assignments[0].assignedRoom").value("101"));
    }

    @Test
    void assignEndpointHandlesMissingListsAsEmpty() throws Exception {
        mockMvc.perform(post("/api/assign")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"applicants\":null,\"availableRooms\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignments.length()").value(0))
                .andExpect(jsonPath("$.unassigned.length()").value(0));
    }
}
