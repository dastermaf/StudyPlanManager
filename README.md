# StudyPlanManager (Recode)

Heads up: This branch is where we're rebuilding the StudyPlanManager project from the ground up.

## About The Project

StudyPlanManager is basically a web app meant to help students at Okayama University of Science (OUS) get through their autumn semester (秋学期). It lays out the subjects, keeps track of how much time is left before exams, and gathers all the learning materials in one place.

The original code got a bit messy and wasn't built very efficiently. So, this branch is all about rewriting the backend to make it more stable, easier to scale, and just generally better structured using modern approaches.

### What it did originally:

* Exam Countdown: Showed the time left until final exams.
* Structured Curriculum: Broke down each subject into 15 weekly sections to match the semester schedule.
* Weekly Lessons: Listed the online lessons for each week.
* Student Dashboard: Gave students a personal space with study stats and a simple to-do list.
* Consolidated Resources: Each section included notes from video lessons and other helpful materials, all under a CC0 license.

## Why the Recode?

1.  Better Architecture: We're moving away from the old, tangled structure to something cleaner and easier to work with long-term.
2.  More Stability: The goal is a more reliable backend that doesn't fall over.
3.  Modern Tech: We're switching the server over to NestJS, which is a modern Node.js framework designed for building solid, scalable apps.

## Current Status

We're just getting started with this rewrite. Right now, the main job is setting up a good foundation before we start adding back all the features.

## Tech Stack

* Backend: NestJS (running on Node.js)
* Language: TypeScript
* Build Automation: Taskfile (go-task) is helping out with build steps.
* Containerization: Docker is set up for easier deployment later on.

## Getting Started (For Development)

Since things are still changing, these instructions might evolve.

1.  Clone the repo:
    ```bash
    git clone [https://github.com/dastermaf/StudyPlanManager.git](https://github.com/dastermaf/StudyPlanManager.git)
    cd StudyPlanManager-recode
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
    *(Or `npm ci` if you want to install exactly what's in the `package-lock.json`)*

3.  Build the project (compile TypeScript):
    ```bash
    go-task build
    ```

4.  Run the application:
    ```bash
    npm start
    ```

## License

This project uses the GNU Affero General Public License v3.0. You can read the full details in the [LICENSE](LICENSE) file.
