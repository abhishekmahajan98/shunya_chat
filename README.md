# Shunya Chat

Shunya Chat is a modern, responsive chat application built using React, TypeScript, and Ant Design. It offers a sleek chat interface with simulated AI responses, customizable model selection, and intuitive navigation between Chat, Spaces, and Settings pages.

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [Customization](#customization)
- [Build](#build)
- [Contributing](#contributing)
- [License](#license)
- [Screenshots](#screenshots)

## Features

- **Real-Time Chat Interface**: Send messages and view simulated AI responses with an animated spinner.
- **Model Selection**: Choose between different AI models using an intuitive dropdown.
- **Responsive Design**: Seamless experience across desktop and mobile with collapsible sidebars and drawers.
- **Modern UI**: Dark mode theming powered by Ant Design’s ConfigProvider.
- **Routing**: Navigate effortlessly between Chat, Spaces, and Settings pages using React Router.

## Technologies Used

- **React** with **TypeScript**
- **Ant Design** (and Ant Design Icons)
- **React Router**
- **CSS** for custom styling

## Project Structure

```
shunya-chat/
├── assets/
│   └── screenshots/
│       ├── ss_1.jpg
│       ├── ss2_jpg
│       └── ... (additional screenshots)
├── src/
│   ├── pages/
│   │   ├── AppMenu.tsx       // Refactored app menu (formerly LeftSidebar)
│   │   ├── ChatPage.tsx
│   │   ├── RightSidebar.tsx
│   │   ├── SpacesPage.tsx    // Placeholder for Spaces
│   │   └── SettingsPage.tsx  // Placeholder for Settings
│   ├── global_ant_design.css // Global CSS overrides for Ant Design
│   ├── App.tsx               // Main routing and app layout
│   └── main.tsx              // Entry point with theme and router setup
├── package.json
└── README.md
```

## Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/abhishekmahajan98/shunya_chat.git
   cd shunya-chat
   ```

2. **Install Dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Start the Development Server**

   ```bash
   npm start
   # or
   yarn start
   ```

   The application will run at [http://localhost:3000](http://localhost:3000).

## Usage

- **Chat Interface**: Type your message in the input box and press **Enter** (or click the send button) to see your message appear along with a simulated AI response.
- **Model Selection**: Click the model dropdown button to switch between available AI models.
- **Navigation**: Use the App Menu on the left (or the drawer on mobile) to navigate between Chat, Spaces, and Settings.
- **Responsive Experience**: The layout adapts automatically to both desktop and mobile views.

## Customization

- **Theme**: The application uses Ant Design’s dark theme. Adjust the theme tokens (e.g., primary color, background, text color) in `main.tsx` as needed.
- **Components**: The UI components are modular and can be extended or modified in the `/src/pages` directory.

## Build

To create an optimized production build:

```bash
npm run build
# or
yarn build
```

The production build will be generated in the `/build` directory.

## Screenshots

Below are some screenshots of Shunya Chat:

![Screenshot 1](src/assets/screenshots/ss1.jpg)
![Screenshot 2](src/assets/screenshots/ss2jpg)
![Screenshot 3](src/assets/screenshots/ss3.jpg)
![Screenshot 4](src/assets/screenshots/ss4jpg)
![Screenshot 5](src/assets/screenshots/ss5.jpg)
<!-- Add additional screenshots as needed -->

---

Enjoy using Shunya Chat and happy chatting!
```

---

You can adjust any sections as necessary. Simply save this content as `README.md` in your project’s root directory.