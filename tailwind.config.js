/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                dark: {
                    900: '#1e1e1e', // 헤더/푸터
                    800: '#2b2b2b', // 메인 배경
                    700: '#383838', // 카드 배경
                    600: '#444444', // 입력창
                },
                primary: '#3498db', // 파란색
                accent: '#f1c40f',  // 노란색
            }
        },
    },
    plugins: [],
}