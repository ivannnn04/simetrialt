import type { ProjectSlide } from "@/components/home/ProjectsSlider";

/** Slides for the vertical projects slider (home + services). Same photo, different copy. */
export const PROJECT_SLIDES_IMAGE = "/images/projects/prusta.jpg";

export const PROJECT_SLIDES: ProjectSlide[] = [
          {
            category: "Apartment",
            title: "PRUSTA Jogailos butas",
            text: "Lighting project development, calculations and compliance, smart lighting integration and custom fixtures, from concept through to handover.",
            info: [
              ["Location", "Vilnius"],
              ["Duration", "22 month"],
              ["Year", "2026"],
              ["Rooms", "140"],
            ],
          },
          {
            category: "Hotel",
            title: "Grand Hotel Kempinski suites",
            text: "Full furniture and lighting specification for 120 suites, sourced from six brands and delivered in three phases without a single day of downtime.",
            info: [
              ["Location", "Vilnius"],
              ["Duration", "14 month"],
              ["Year", "2025"],
              ["Rooms", "120"],
            ],
          },
          {
            category: "Office",
            title: "Quadrum business centre",
            text: "Workplace furniture, acoustic solutions and a custom lighting scheme for 4,000 m² of open-plan and meeting space, installed over one summer.",
            info: [
              ["Location", "Vilnius"],
              ["Duration", "9 month"],
              ["Year", "2024"],
              ["Area", "4 000 m²"],
            ],
          },
        ];
