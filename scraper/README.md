# Nigerian Tertiary Data Scraper

A Node.js script to scrape academic hierarchy data (School → Faculty → Department → Course Code) from Nigerian tertiary institutions via myschool.ng.

## Features
- Extracts course names and isolates alphanumeric codes (e.g., "CSC 111") using Regex.
- Maps courses to their respective faculties by traversing the JAMB Brochure hierarchy.
- Implements request throttling (2s delay) to maintain a low profile.
- Handles missing course codes by defaulting to "N/A".
- Saves results to a structured `nigerian_tertiary_master.json`.

## Prerequisites
- Node.js (v14+)
- npm

## Installation
```bash
cd scraper
npm install
```

## Usage
To run a sample scrape (default: 3 institutions):
```bash
node index.js
```

To run a full scrape, open `index.js` and modify the configuration:
```javascript
const SAMPLE_SIZE = Infinity; // Change this value
```

## Data Schema
```json
{
  "institution": "University Name",
  "type": "University/Polytechnic/College of Education",
  "faculties": [
    {
      "faculty_name": "Faculty Name",
      "courses": [
        {
          "course_name": "Course Name",
          "course_code": "CODE"
        }
      ]
    }
  ]
}
```
