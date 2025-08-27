# Exam-Duty-IIITR

A modern React-based application for generating and managing exam duty schedules at IIIT Raichur.

## Features

- **Intelligent Scheduling**: Advanced algorithm for optimal duty distribution
- **Faculty Constraints**: Support for pre-assigned faculty and seniority-based assignments
- **Staff Balancing**: Ensures equitable workload distribution among staff
- **Excel Integration**: Import faculty/staff data from Excel files
- **Interactive UI**: Modern, responsive interface built with React and Tailwind CSS
- **Validation**: Comprehensive schedule validation and constraint checking

## Technology Stack

- **Frontend**: React 18.3.1 with TypeScript 5.5.3
- **Styling**: Tailwind CSS with Lucide React icons
- **Build Tool**: Vite 5.4.2
- **File Processing**: XLSX library for Excel file handling
- **Code Quality**: ESLint with TypeScript support

## Architecture

### Modular Schedule Generator

The application features a completely refactored, modular schedule generator that replaced a monolithic 1000+ line file with focused modules:

```
src/utils/scheduler/
├── schedulerInterfaces.ts  # TypeScript interfaces and type definitions
├── schedulerSetup.ts       # Configuration and input validation logic
├── assignmentTracker.ts    # Assignment tracking and state management
├── personSelector.ts       # Person selection and filtering algorithms
├── roomAssigner.ts         # Room position assignment logic
├── facultyPreAssigner.ts   # Faculty pre-assignment constraint handling
├── workloadBalancer.ts     # Workload balancing and seniority algorithms
├── scheduleValidator.ts    # Schedule validation and constraint fixing
└── index.ts                # Clean module exports
```

### Project Structure

```
src/
├── components/           # Reusable UI components
├── constants/           # Application constants
├── hooks/              # Custom React hooks
├── services/           # Business logic and data processing
├── types/              # Shared type definitions
├── utils/              # Utility functions and scheduler
├── App.tsx             # Main application component
└── main.tsx           # Application entry point
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Exam-Duty-IIITR
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Usage

### Basic Schedule Generation

1. **Upload Faculty/Staff Data**: Import an Excel file containing faculty and staff information
2. **Set Parameters**: Configure the number of days and rooms for the exam period
3. **Add Constraints**: Optionally specify faculty pre-assignments for specific days
4. **Generate Schedule**: Click generate to create an optimized duty schedule
5. **Review & Export**: Review the generated schedule and export as needed

### Advanced Features

#### Faculty Pre-Assignment
- Assign specific faculty members to particular days
- Maintains all scheduling constraints and workload balancing
- Useful for accommodating faculty availability

#### Workload Balancing
- Automatic distribution of duties based on seniority
- Staff target duty calculation (typically days-1)
- Faculty duty allocation with senior faculty preference

#### Constraint Management
- Prevents consecutive day assignments to the same room
- Ensures no person is assigned to multiple rooms on the same day
- Validates duty count targets for all staff members

## Algorithm Features

### Intelligent Assignment
- **Seniority-Based**: Respects faculty/staff hierarchy in assignments
- **Constraint Satisfaction**: Ensures all hard constraints are met
- **Optimized Distribution**: Balances workload across all personnel
- **Fallback Logic**: Robust handling of edge cases and conflicts

### Validation System
- **Input Validation**: Validates all parameters and constraints
- **Schedule Integrity**: Ensures generated schedules meet all requirements
- **Error Handling**: Comprehensive error reporting and recovery

## Configuration

### Schedule Parameters
- **Days**: 1-10 exam days supported
- **Rooms**: 1-20 exam rooms supported
- **Staff Duty Target**: Automatically calculated based on total positions
- **Faculty Constraints**: Seniority-based duty distribution

### File Formats
- **Excel Input**: Supports .xlsx and .xls files
- **Faculty Data**: Names and types (faculty/staff) required
- **Pre-assignments**: Optional day-specific faculty assignments

## Development

### Scripts
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint checks
```

### Code Quality
- TypeScript for type safety
- ESLint for code quality
- Modular architecture for maintainability
- Comprehensive error handling

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Documentation

- [Schedule Generator Refactoring](./SCHEDULE_GENERATOR_REFACTORING.md) - Detailed architecture documentation
- [Schedule Generator Fixes](./SCHEDULE_GENERATOR_FIXES.md) - Algorithm improvements and fixes

## License

This project is licensed under the MIT License.

## Author

**Aditya Singh** (2022UG2062)  
Indian Institute of Information Technology, Raichur (IIITR)

---

Built with ❤️ for efficient exam duty management at IIIT Raichur.