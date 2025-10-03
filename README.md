# IOS Screen Mirror

This project is designed to monitor the screen of iOS devices (iPad, iPhone) that are mirrored using the AirConnect application. It analyzes the mirrored screen data to detect the percentage of text present and sends notifications via a Discord bot if the text percentage exceeds a specified threshold.

## Project Structure

```
ios-screen-mirror
├── src
│   ├── main.ts                # Entry point of the application
│   ├── airconnect
│   │   └── index.ts           # Handles connection to AirConnect and retrieves screen data
│   ├── text-detection
│   │   └── index.ts           # Analyzes screen data for text detection
│   ├── discord-bot
│   │   └── index.ts           # Manages Discord notifications
│   └── types
│       └── index.ts           # Defines data structures used in the application
├── package.json                # npm configuration file
├── tsconfig.json               # TypeScript configuration file
└── README.md                   # Project documentation
```

## Features

- Connects to the 3utools air application to retrieve mirrored screen data.
- Analyzes the screen data to detect text and calculates the percentage of text present.
- Sends notifications to a Discord channel when the text percentage exceeds 50%.

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd ipad-screen-monitor
   ```
3. Install the dependencies:
   ```
   npm install
   ```

## Usage

To start the application, run the following command:
```
npm start
```

Ensure that the AirConnect application is running and the iPad screen is mirrored before starting the application.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or features you would like to add.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.
