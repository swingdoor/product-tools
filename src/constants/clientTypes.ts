export const ClientTypes = {
    Web: {
        label: 'Web (PC端)',
        width: 1440,
        height: 900,
        desc: '1440×900px（标准PC桌面端）',
        layoutGuide: '- 布局特点：顶部导航栏60px，左侧侧边栏220px，主内容区填充剩余宽度，右侧属性栏（可选）'
    },
    App: {
        label: 'App (移动端)',
        width: 390,
        height: 844,
        desc: '390×844px（iPhone 14标准尺寸）',
        layoutGuide: '- 布局特点：顶部状态栏44px，底部导航栏83px，内容区竖向排列，全宽组件'
    },
    MiniProgram: {
        label: '小程序',
        width: 375,
        height: 812,
        desc: '375×812px（微信小程序标准尺寸）',
        layoutGuide: '- 布局特点：顶部自定义导航44px，底部tabbar50px，内容区竖向排列'
    },
    Pad: {
        label: '平板端 (iPad)',
        width: 1024,
        height: 1366,
        desc: '1024×1366px（iPad Pro 12.9寸）',
        layoutGuide: '- 布局特点：可使用分栏布局，左侧导航200px，右侧内容区'
    }
} as const;

export type ClientTypeKey = keyof typeof ClientTypes;
