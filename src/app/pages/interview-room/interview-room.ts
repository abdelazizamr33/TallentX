import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
declare var JitsiMeetExternalAPI: any;


@Component({
  selector: 'app-interview-room',
  imports: [],
  templateUrl: './interview-room.html',
  styleUrl: './interview-room.css',
})
export class InterviewRoom implements AfterViewInit {

  @ViewChild('jitsiContainer') jitsiContainer!: ElementRef;

  constructor(private route: ActivatedRoute) {}

  ngAfterViewInit() {
    const roomId = this.route.snapshot.paramMap.get('id');

    const domain = "meet.jit.si";

    const options = {
      roomName: `TallentX-${roomId}`,
      parentNode: this.jitsiContainer.nativeElement,
      width: "100%",
      height: "100%",

      userInfo: {
        displayName: this.getUserName()
      },

      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        prejoinPageEnabled: false
      },

      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        TOOLBAR_BUTTONS: [
          'microphone',
          'camera',
          'desktop',
          'chat',
          'fullscreen',
          'hangup'
        ]
      }
    };

    const api = new JitsiMeetExternalAPI(domain, options);

    // events
    api.addListener("videoConferenceJoined", () => {
      console.log("دخل الكول");
    });

    api.addListener("videoConferenceLeft", () => {
      console.log("خرج من الكول");
    });
  }

  getUserName(): string {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.fullName) return user.fullName;
        if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
      } catch (e) {}
    }
    
    // Fallback for recruiter
    const email = localStorage.getItem('ies_email');
    if (email) {
      return email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    return 'Guest';
  }
}

